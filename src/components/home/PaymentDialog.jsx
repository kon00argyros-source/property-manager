import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button, Card, CardContent, Badge, Input, Label } from '@/components/ui';
import { Check, Euro } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const ROOMS = [1,2,3,4,5,6,7,8,9,10,11,12];
const MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];

export default function PaymentDialog({ open, onClose, onSaved }) {
  const [room, setRoom] = useState('');
  const [payType, setPayType] = useState('');
  const [unpaidRecords, setUnpaidRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [rentAmount, setRentAmount] = useState(null);
  const [rentMonth, setRentMonth] = useState('');
  const [rentYear, setRentYear] = useState(String(new Date().getFullYear()));
  const [paying, setPaying] = useState(false);
  const [roomNames, setRoomNames] = useState(roomNamesCache.get());
  // Μερική πληρωμή
  const [partialAmount, setPartialAmount] = useState('');
  const [isPartial, setIsPartial] = useState(false);

  useEffect(() => { const unsub = roomNamesCache.subscribe(setRoomNames); return unsub; }, []);
  useEffect(() => { setSelectedRecord(null); setUnpaidRecords([]); setRentAmount(null); setRentMonth(''); setPartialAmount(''); setIsPartial(false); }, [room, payType]);

  useEffect(() => {
    if (!room || !payType) return;
    const roomNum = parseInt(room);
    const load = async () => {
      if (payType === 'rent') {
        const rooms = await db.Room.filter({ room_number: roomNum });
        setRentAmount(rooms[0]?.rent_amount || 0);
      } else if (payType === 'power') {
        setUnpaidRecords(await db.PowerRecord.filter({ room_number: roomNum, is_paid: false }, '-created_date'));
      } else if (payType === 'water') {
        setUnpaidRecords(await db.WaterRecord.filter({ room_number: roomNum, is_paid: false }, '-created_date'));
      }
    };
    load();
  }, [room, payType]);

  // Όταν επιλέγεται record, γέμισε το partial με το πλήρες ποσό
  useEffect(() => {
    if (selectedRecord) setPartialAmount(String(selectedRecord.amount));
  }, [selectedRecord]);

  // Όταν επιλέγεται rent, γέμισε το partial με το πλήρες ποσό
  useEffect(() => {
    if (rentAmount !== null) setPartialAmount(String(rentAmount));
  }, [rentAmount]);

  const handlePay = async () => {
    setPaying(true);
    const today = format(new Date(), 'dd/MM/yyyy');
    const paid = parseFloat(partialAmount);

    if (payType === 'rent') {
      if (!rentMonth) { toast.error('Επιλέξτε μήνα'); setPaying(false); return; }
      if (isNaN(paid) || paid <= 0) { toast.error('Εισάγετε έγκυρο ποσό'); setPaying(false); return; }

      const fullAmount = rentAmount;
      const isFullPayment = paid >= fullAmount;
      const remaining = fullAmount - paid;
      const periodStr = `${rentMonth}/${rentYear}`;
      const partialNote = !isFullPayment
        ? `Μερική πληρωμή €${paid.toFixed(2)} στις ${today}. Υπόλοιπο: €${remaining.toFixed(2)}`
        : null;

      if (isFullPayment) {
        // Πλήρης πληρωμή
        await db.RentPayment.create({
          room_number: parseInt(room),
          period: periodStr,
          amount: fullAmount,
          is_paid: true,
          paid_date: today,
        });
        toast.success('Εξοφλήθηκε πλήρως');
      } else {
        // Μερική: δημιουργία δύο εγγραφών - μία πληρωμένη και μία με υπόλοιπο
        await db.RentPayment.create({
          room_number: parseInt(room),
          period: periodStr,
          amount: paid,
          original_amount: fullAmount,
          is_paid: true,
          paid_date: today,
          partial_notes: `Μερική πληρωμή από σύνολο €${fullAmount.toFixed(2)}`,
        });
        // Υπόλοιπο ποσό παραμένει ανεξόφλητο
        await db.RentPayment.create({
          room_number: parseInt(room),
          period: `${periodStr} (υπόλοιπο)`,
          amount: remaining,
          original_amount: fullAmount,
          is_paid: false,
          partial_notes: `Υπόλοιπο μετά από μερική πληρωμή €${paid.toFixed(2)} στις ${today}`,
        });
        toast.success(`Καταχωρήθηκε €${paid.toFixed(2)}. Υπόλοιπο: €${remaining.toFixed(2)}`);
      }
    } else if ((payType === 'power' || payType === 'water') && selectedRecord) {
      if (isNaN(paid) || paid <= 0) { toast.error('Εισάγετε έγκυρο ποσό'); setPaying(false); return; }
      const entity = payType === 'power' ? 'PowerRecord' : 'WaterRecord';
      const fullAmount = selectedRecord.amount;
      const isFullPayment = paid >= fullAmount;
      const remaining = fullAmount - paid;

      if (isFullPayment) {
        await db[entity].update(selectedRecord.id, { is_paid: true, paid_date: today });
        toast.success('Εξοφλήθηκε πλήρως');
      } else {
        // Μαρκάρουμε το παλιό ως πληρωμένο με μειωμένο ποσό
        await db[entity].update(selectedRecord.id, {
          is_paid: true,
          paid_date: today,
          amount: paid,
        });
        // Δημιουργούμε νέο με υπόλοιπο
        await db[entity].create({
          room_number: selectedRecord.room_number,
          period: `${selectedRecord.period} (υπόλοιπο)`,
          previous_measure: selectedRecord.previous_measure,
          new_measure: selectedRecord.new_measure,
          usage: selectedRecord.usage,
          amount: remaining,
          is_paid: false,
        });
        toast.success(`Καταχωρήθηκε €${paid.toFixed(2)}. Υπόλοιπο: €${remaining.toFixed(2)}`);
      }
    }

    setPaying(false);
    onSaved?.();
    onClose();
    setRoom(''); setPayType(''); setSelectedRecord(null); setPartialAmount(''); setIsPartial(false);
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const currentFullAmount = payType === 'rent' ? rentAmount : selectedRecord?.amount;
  const paidNum = parseFloat(partialAmount) || 0;
  const isPartialPayment = currentFullAmount && paidNum > 0 && paidNum < currentFullAmount;
  const remaining = currentFullAmount ? (currentFullAmount - paidNum) : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>💰 Καταχώρηση Πληρωμής</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Δωμάτιο</Label>
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε δωμάτιο" /></SelectTrigger>
              <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={String(r)}>{roomNames[r] || `Δωμάτιο ${r}`}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {room && (
            <div className="space-y-2">
              <Label>Τύπος Πληρωμής</Label>
              <Select value={payType} onValueChange={setPayType}>
                <SelectTrigger><SelectValue placeholder="Επιλέξτε τύπο" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">🏠 Ενοίκιο</SelectItem>
                  <SelectItem value="power">⚡ Ρεύμα</SelectItem>
                  <SelectItem value="water">💧 Νερό</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {payType === 'rent' && rentAmount !== null && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Μήνας</Label>
                <div className="flex gap-2">
                  <Select value={rentMonth} onValueChange={setRentMonth}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Μήνας" /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={rentYear} onValueChange={setRentYear}>
                    <SelectTrigger className="w-24"><SelectValue placeholder="Έτος" /></SelectTrigger>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Συνολικό ενοίκιο</span>
                    <span className="text-xl font-bold text-primary flex items-center gap-1"><Euro className="w-5 h-5" />{rentAmount?.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ποσό πληρωμής (μπορείτε να αλλάξετε για μερική πληρωμή)</Label>
                    <Input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  {isPartialPayment && (
                    <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">⚠️ Μερική πληρωμή — Υπόλοιπο: €{remaining.toFixed(2)}</p>
                      <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">Το υπόλοιπο θα παραμείνει ως ανεξόφλητο</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {(payType === 'power' || payType === 'water') && (
            <div className="space-y-2">
              {unpaidRecords.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-4">Δεν υπάρχουν ανεξόφλητες εγγραφές</p>
                : unpaidRecords.map(record => (
                  <Card key={record.id} className={`cursor-pointer transition-all ${selectedRecord?.id === record.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/50'}`} onClick={() => setSelectedRecord(record)}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div><p className="text-sm font-medium">{record.period}</p><p className="text-xs text-muted-foreground">{record.usage} {payType === 'power' ? 'kWh' : 'm³'}</p></div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-red-100 text-red-700">€{record.amount?.toFixed(2)}</Badge>
                        {selectedRecord?.id === record.id && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    </CardContent>
                  </Card>
                ))
              }
              {selectedRecord && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs">Ποσό πληρωμής (μπορείτε να αλλάξετε για μερική πληρωμή)</Label>
                  <Input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" />
                  {isPartialPayment && (
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">⚠️ Μερική πληρωμή — Υπόλοιπο: €{remaining.toFixed(2)}</p>
                      <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">Το υπόλοιπο θα παραμείνει ως ανεξόφλητο</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {((payType === 'rent' && rentMonth && partialAmount) || ((payType === 'power' || payType === 'water') && selectedRecord && partialAmount)) && (
            <Button onClick={handlePay} disabled={paying} className="w-full bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />{paying ? 'Επεξεργασία...' : `Επιβεβαίωση Πληρωμής €${paidNum.toFixed(2)}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
