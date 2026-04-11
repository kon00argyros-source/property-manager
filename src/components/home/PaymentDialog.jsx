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
  const [existingUnpaidRent, setExistingUnpaidRent] = useState(null); // auto-created unpaid rent
  const [rentMonth, setRentMonth] = useState('');
  const [rentYear, setRentYear] = useState(String(new Date().getFullYear()));
  const [paying, setPaying] = useState(false);
  const [roomNames, setRoomNames] = useState(roomNamesCache.get());
  const [partialAmount, setPartialAmount] = useState('');

  useEffect(() => { const unsub = roomNamesCache.subscribe(setRoomNames); return unsub; }, []);

  useEffect(() => {
    setSelectedRecord(null); setUnpaidRecords([]); setRentAmount(null);
    setRentMonth(''); setPartialAmount(''); setExistingUnpaidRent(null);
  }, [room, payType]);

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

  // When month/year changes for rent, check if auto-created unpaid record exists
  useEffect(() => {
    if (!room || payType !== 'rent' || !rentMonth || !rentYear) return;
    const roomNum = parseInt(room);
    const periodStr = `${rentMonth}/${rentYear}`;
    db.RentPayment.filter({ room_number: roomNum, period: periodStr, is_paid: false }).then(records => {
      setExistingUnpaidRent(records.length > 0 ? records[0] : null);
    });
  }, [room, rentMonth, rentYear, payType]);

  useEffect(() => {
    if (rentAmount !== null) setPartialAmount(String(rentAmount));
  }, [rentAmount]);

  useEffect(() => {
    if (selectedRecord) setPartialAmount(String(selectedRecord.amount));
  }, [selectedRecord]);

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

      if (existingUnpaidRent) {
        // UPDATE the existing auto-created unpaid record instead of creating new
        if (isFullPayment) {
          await db.RentPayment.update(existingUnpaidRent.id, {
            is_paid: true,
            paid_date: today,
            amount: fullAmount,
          });
          toast.success('Εξοφλήθηκε πλήρως ✓');
        } else {
          // Mark existing as partially paid
          await db.RentPayment.update(existingUnpaidRent.id, {
            is_paid: true,
            paid_date: today,
            amount: paid,
            original_amount: fullAmount,
            partial_notes: `Μερική πληρωμή €${paid.toFixed(2)} από €${fullAmount.toFixed(2)} στις ${today}`,
          });
          // Create remaining unpaid record
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
      } else {
        // No existing record — create new paid record
        if (isFullPayment) {
          await db.RentPayment.create({
            room_number: parseInt(room),
            period: periodStr,
            amount: fullAmount,
            is_paid: true,
            paid_date: today,
          });
          toast.success('Εξοφλήθηκε πλήρως ✓');
        } else {
          await db.RentPayment.create({
            room_number: parseInt(room),
            period: periodStr,
            amount: paid,
            original_amount: fullAmount,
            is_paid: true,
            paid_date: today,
            partial_notes: `Μερική πληρωμή €${paid.toFixed(2)} από €${fullAmount.toFixed(2)} στις ${today}`,
          });
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
      }

    } else if ((payType === 'power' || payType === 'water') && selectedRecord) {
      if (isNaN(paid) || paid <= 0) { toast.error('Εισάγετε έγκυρο ποσό'); setPaying(false); return; }
      const entity = payType === 'power' ? 'PowerRecord' : 'WaterRecord';
      const fullAmount = selectedRecord.amount;
      const isFullPayment = paid >= fullAmount;
      const remaining = fullAmount - paid;

      if (isFullPayment) {
        await db[entity].update(selectedRecord.id, { is_paid: true, paid_date: today });
        toast.success('Εξοφλήθηκε πλήρως ✓');
      } else {
        await db[entity].update(selectedRecord.id, { is_paid: true, paid_date: today, amount: paid });
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
    setRoom(''); setPayType(''); setSelectedRecord(null); setPartialAmount('');
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
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Show if existing unpaid record found */}
              {rentMonth && existingUnpaidRent && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    ✓ Βρέθηκε ανεξόφλητο ενοίκιο για {MONTHS[parseInt(rentMonth)-1]} — θα ενημερωθεί αυτόματα
                  </p>
                </div>
              )}

              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Ενοίκιο μήνα</span>
                    <span className="text-xl font-bold text-primary flex items-center gap-1">
                      <Euro className="w-5 h-5" />{rentAmount?.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ποσό πληρωμής</Label>
                    <Input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" />
                  </div>
                  {isPartialPayment && (
                    <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">⚠️ Μερική πληρωμή — Υπόλοιπο: €{remaining.toFixed(2)}</p>
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
                  <Card key={record.id}
                    className={`cursor-pointer transition-all ${selectedRecord?.id === record.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/50'}`}
                    onClick={() => setSelectedRecord(record)}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{record.period}</p>
                        <p className="text-xs text-muted-foreground">{record.usage} {payType === 'power' ? 'kWh' : 'm³'}</p>
                      </div>
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
                  <Label className="text-xs">Ποσό πληρωμής</Label>
                  <Input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" />
                  {isPartialPayment && (
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">⚠️ Μερική πληρωμή — Υπόλοιπο: €{remaining.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {((payType === 'rent' && rentMonth && partialAmount) ||
            ((payType === 'power' || payType === 'water') && selectedRecord && partialAmount)) && (
            <Button onClick={handlePay} disabled={paying} className="w-full bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />
              {paying ? 'Επεξεργασία...' : `Επιβεβαίωση Πληρωμής €${paidNum.toFixed(2)}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
