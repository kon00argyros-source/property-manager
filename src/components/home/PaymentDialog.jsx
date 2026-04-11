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
  const [rentMonth, setRentMonth] = useState('');
  const [rentYear, setRentYear] = useState(String(new Date().getFullYear()));
  const [paying, setPaying] = useState(false);
  const [roomNames, setRoomNames] = useState(roomNamesCache.get());
  const [partialAmount, setPartialAmount] = useState('');
  // All unpaid rent records for selected month (including remainders)
  const [unpaidRentForMonth, setUnpaidRentForMonth] = useState([]);
  const [selectedRentRecord, setSelectedRentRecord] = useState(null);

  useEffect(() => { const unsub = roomNamesCache.subscribe(setRoomNames); return unsub; }, []);

  useEffect(() => {
    setSelectedRecord(null); setUnpaidRecords([]); setRentMonth('');
    setPartialAmount(''); setUnpaidRentForMonth([]); setSelectedRentRecord(null);
  }, [room, payType]);

  // Load unpaid power/water records
  useEffect(() => {
    if (!room || (payType !== 'power' && payType !== 'water')) return;
    const roomNum = parseInt(room);
    const entity = payType === 'power' ? 'PowerRecord' : 'WaterRecord';
    db[entity].filter({ room_number: roomNum, is_paid: false }, '-created_date').then(setUnpaidRecords);
  }, [room, payType]);

  // When month/year changes for rent, find ALL unpaid records for that month
  useEffect(() => {
    if (!room || payType !== 'rent' || !rentMonth || !rentYear) return;
    const roomNum = parseInt(room);
    const periodStr = `${rentMonth}/${rentYear}`;

    // Find all unpaid rent records that start with this period (includes "υπόλοιπο" records)
    db.RentPayment.filter({ room_number: roomNum, is_paid: false }, '-created_date').then(allUnpaid => {
      const forThisMonth = allUnpaid.filter(r =>
        r.period === periodStr ||
        r.period?.startsWith(`${periodStr} `)
      );
      setUnpaidRentForMonth(forThisMonth);
      // Auto-select if only one
      if (forThisMonth.length === 1) {
        setSelectedRentRecord(forThisMonth[0]);
        setPartialAmount(String(forThisMonth[0].amount));
      } else {
        setSelectedRentRecord(null);
        setPartialAmount('');
      }
    });
  }, [room, rentMonth, rentYear, payType]);

  useEffect(() => {
    if (selectedRecord) setPartialAmount(String(selectedRecord.amount));
  }, [selectedRecord]);

  useEffect(() => {
    if (selectedRentRecord) setPartialAmount(String(selectedRentRecord.amount));
  }, [selectedRentRecord]);

  const handlePay = async () => {
    setPaying(true);
    const today = format(new Date(), 'dd/MM/yyyy');
    const paid = parseFloat(partialAmount);
    if (isNaN(paid) || paid <= 0) { toast.error('Εισάγετε έγκυρο ποσό'); setPaying(false); return; }

    if (payType === 'rent') {
      if (!rentMonth) { toast.error('Επιλέξτε μήνα'); setPaying(false); return; }
      const periodStr = `${rentMonth}/${rentYear}`;
      const fullAmount = selectedRentRecord ? selectedRentRecord.amount : parseFloat(partialAmount);
      const isFullPayment = paid >= fullAmount;
      const remaining = fullAmount - paid;

      if (selectedRentRecord) {
        // UPDATE existing unpaid record
        if (isFullPayment) {
          await db.RentPayment.update(selectedRentRecord.id, {
            is_paid: true, paid_date: today, amount: fullAmount,
          });
          toast.success('Εξοφλήθηκε πλήρως ✓');
        } else {
          await db.RentPayment.update(selectedRentRecord.id, {
            is_paid: true, paid_date: today, amount: paid,
            original_amount: fullAmount,
            partial_notes: `Μερική πληρωμή €${paid.toFixed(2)} από €${fullAmount.toFixed(2)} στις ${today}`,
          });
          await db.RentPayment.create({
            room_number: parseInt(room),
            period: selectedRentRecord.period.includes('υπόλοιπο')
              ? selectedRentRecord.period
              : `${periodStr} (υπόλοιπο)`,
            amount: remaining,
            original_amount: selectedRentRecord.original_amount || fullAmount,
            is_paid: false,
            partial_notes: `Υπόλοιπο μετά από μερική πληρωμή €${paid.toFixed(2)} στις ${today}`,
          });
          toast.success(`Καταχωρήθηκε €${paid.toFixed(2)}. Υπόλοιπο: €${remaining.toFixed(2)}`);
        }
      } else {
        // No existing record — create new
        await db.RentPayment.create({
          room_number: parseInt(room), period: periodStr,
          amount: paid, is_paid: true, paid_date: today,
        });
        if (!isFullPayment) {
          // Get room rent amount for remainder
          const rooms = await db.Room.filter({ room_number: parseInt(room) });
          const roomRent = rooms[0]?.rent_amount || paid;
          if (paid < roomRent) {
            await db.RentPayment.create({
              room_number: parseInt(room),
              period: `${periodStr} (υπόλοιπο)`,
              amount: roomRent - paid, original_amount: roomRent, is_paid: false,
              partial_notes: `Υπόλοιπο μετά από μερική πληρωμή €${paid.toFixed(2)} στις ${today}`,
            });
          }
        }
        toast.success('Πληρωμή καταχωρήθηκε ✓');
      }

    } else if ((payType === 'power' || payType === 'water') && selectedRecord) {
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
          amount: remaining, is_paid: false,
        });
        toast.success(`Καταχωρήθηκε €${paid.toFixed(2)}. Υπόλοιπο: €${remaining.toFixed(2)}`);
      }
    }

    setPaying(false); onSaved?.(); onClose();
    setRoom(''); setPayType(''); setSelectedRecord(null);
    setSelectedRentRecord(null); setPartialAmount('');
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const paidNum = parseFloat(partialAmount) || 0;
  const currentFullAmount = selectedRentRecord?.amount || selectedRecord?.amount;
  const isPartialPayment = currentFullAmount && paidNum > 0 && paidNum < currentFullAmount;
  const remaining = currentFullAmount ? currentFullAmount - paidNum : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>💰 Καταχώρηση Πληρωμής</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Room */}
          <div className="space-y-2">
            <Label>Δωμάτιο</Label>
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε δωμάτιο" /></SelectTrigger>
              <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={String(r)}>{roomNames[r] || `Δωμάτιο ${r}`}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Type */}
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

          {/* RENT */}
          {payType === 'rent' && (
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

              {/* Show unpaid records for this month */}
              {rentMonth && unpaidRentForMonth.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Ανεξόφλητες οφειλές για {MONTHS[parseInt(rentMonth)-1]} {rentYear}:</p>
                  {unpaidRentForMonth.map(record => (
                    <Card key={record.id}
                      className={`cursor-pointer transition-all ${selectedRentRecord?.id === record.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/50'}`}
                      onClick={() => { setSelectedRentRecord(record); setPartialAmount(String(record.amount)); }}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{record.period}</p>
                          {record.partial_notes && <p className="text-xs text-orange-600 mt-0.5">{record.partial_notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-red-100 text-red-700">€{record.amount?.toFixed(2)}</Badge>
                          {selectedRentRecord?.id === record.id && <Check className="w-4 h-4 text-primary" />}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* No unpaid for this month */}
              {rentMonth && unpaidRentForMonth.length === 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-3">
                  <p className="text-xs text-green-700 dark:text-green-400">✓ Δεν υπάρχουν ανεξόφλητες οφειλές για αυτό τον μήνα</p>
                </div>
              )}

              {/* Amount input */}
              {selectedRentRecord && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Οφειλή</span>
                      <span className="text-xl font-bold text-primary">€{selectedRentRecord.amount?.toFixed(2)}</span>
                    </div>
                    <Label className="text-xs">Ποσό πληρωμής</Label>
                    <Input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" />
                    {isPartialPayment && (
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                        <p className="text-xs text-orange-700 font-medium">⚠️ Μερική — Υπόλοιπο: €{remaining.toFixed(2)}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* POWER / WATER */}
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
                      <p className="text-xs text-orange-700 font-medium">⚠️ Μερική — Υπόλοιπο: €{remaining.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Confirm button */}
          {((payType === 'rent' && rentMonth && selectedRentRecord && partialAmount) ||
            ((payType === 'power' || payType === 'water') && selectedRecord && partialAmount)) && (
            <Button onClick={handlePay} disabled={paying} className="w-full bg-green-600 hover:bg-green-700">
              <Check className="w-4 h-4 mr-2" />
              {paying ? 'Επεξεργασία...' : `Επιβεβαίωση €${paidNum.toFixed(2)}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
