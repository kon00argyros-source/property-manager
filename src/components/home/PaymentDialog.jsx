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

export default function PaymentDialog({ open, onClose, onSaved, preloaded, preloadedRoom }) {
  const [room, setRoom] = useState('');
  const [payType, setPayType] = useState('');
  const [unpaidRecords, setUnpaidRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [rentMonth, setRentMonth] = useState('');
  const [rentYear, setRentYear] = useState(String(new Date().getFullYear()));
  const [paying, setPaying] = useState(false);
  const [roomNames, setRoomNames] = useState(roomNamesCache.get());
  const [partialAmount, setPartialAmount] = useState('');
  const [unpaidRentForMonth, setUnpaidRentForMonth] = useState([]);
  const [selectedRentRecord, setSelectedRentRecord] = useState(null);

  useEffect(() => { const unsub = roomNamesCache.subscribe(setRoomNames); return unsub; }, []);

  // Apply preloaded values when dialog opens
  useEffect(() => {
    if (!open) return;
    if (preloaded && preloadedRoom) {
      setRoom(String(preloadedRoom));
      setPayType(preloaded.type);
      if (preloaded.type === 'rent' && preloaded.record) {
        // Parse period "4/2026" or "4/2026 (υπόλοιπο)"
        const clean = (preloaded.record.period || '').replace(/\s*\(.*\)/, '').trim();
        const [m, y] = clean.split('/');
        if (m) setRentMonth(m);
        if (y) setRentYear(y);
        setSelectedRentRecord(preloaded.record);
        setPartialAmount(String(preloaded.record.amount));
      } else if ((preloaded.type === 'power' || preloaded.type === 'water') && preloaded.record) {
        setSelectedRecord(preloaded.record);
        setPartialAmount(String(preloaded.record.amount));
      }
    }
  }, [open, preloaded, preloadedRoom]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setRoom(''); setPayType(''); setUnpaidRecords([]); setSelectedRecord(null);
      setRentMonth(''); setPartialAmount(''); setUnpaidRentForMonth([]);
      setSelectedRentRecord(null); setRentYear(String(new Date().getFullYear()));
    }
  }, [open]);

  // Load power/water records when manually selecting room+type
  useEffect(() => {
    if (!room || (payType !== 'power' && payType !== 'water') || selectedRecord) return;
    const entity = payType === 'power' ? 'PowerRecord' : 'WaterRecord';
    db[entity].filter({ room_number: parseInt(room), is_paid: false }, '-created_date').then(setUnpaidRecords);
  }, [room, payType]);

  // Load unpaid rent for selected month (manual selection)
  useEffect(() => {
    if (!room || payType !== 'rent' || !rentMonth || !rentYear || selectedRentRecord) return;
    const periodStr = `${rentMonth}/${rentYear}`;
    db.RentPayment.filter({ room_number: parseInt(room), is_paid: false }, '-created_date').then(all => {
      const forMonth = all.filter(r => r.period === periodStr || r.period?.startsWith(`${periodStr} `));
      setUnpaidRentForMonth(forMonth);
      if (forMonth.length === 1) { setSelectedRentRecord(forMonth[0]); setPartialAmount(String(forMonth[0].amount)); }
    });
  }, [room, rentMonth, rentYear, payType, selectedRentRecord]);

  const handlePay = async () => {
    setPaying(true);
    const today = format(new Date(), 'dd/MM/yyyy');
    const paid = parseFloat(partialAmount);
    if (isNaN(paid) || paid <= 0) { toast.error('Εισάγετε έγκυρο ποσό'); setPaying(false); return; }

    if (payType === 'rent') {
      if (!rentMonth) { toast.error('Επιλέξτε μήνα'); setPaying(false); return; }
      const periodStr = `${rentMonth}/${rentYear}`;
      const fullAmount = selectedRentRecord?.amount || paid;
      const isFullPayment = paid >= fullAmount;
      const remaining = fullAmount - paid;

      if (selectedRentRecord) {
        if (isFullPayment) {
          await db.RentPayment.update(selectedRentRecord.id, { is_paid: true, paid_date: today, amount: fullAmount });
          toast.success('Εξοφλήθηκε πλήρως ✓');
        } else {
          await db.RentPayment.update(selectedRentRecord.id, { is_paid: true, paid_date: today, amount: paid, original_amount: fullAmount, partial_notes: `Μερική €${paid.toFixed(2)} από €${fullAmount.toFixed(2)} στις ${today}` });
          await db.RentPayment.create({ room_number: parseInt(room), period: `${periodStr} (υπόλοιπο)`, amount: remaining, original_amount: fullAmount, is_paid: false, partial_notes: `Υπόλοιπο μετά από μερική πληρωμή €${paid.toFixed(2)} στις ${today}` });
          toast.success(`€${paid.toFixed(2)} καταχωρήθηκε. Υπόλοιπο: €${remaining.toFixed(2)}`);
        }
      } else {
        await db.RentPayment.create({ room_number: parseInt(room), period: periodStr, amount: paid, is_paid: true, paid_date: today });
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
        await db[entity].create({ room_number: selectedRecord.room_number, period: `${selectedRecord.period} (υπόλοιπο)`, previous_measure: selectedRecord.previous_measure, new_measure: selectedRecord.new_measure, usage: selectedRecord.usage, amount: remaining, is_paid: false });
        toast.success(`€${paid.toFixed(2)} καταχωρήθηκε. Υπόλοιπο: €${remaining.toFixed(2)}`);
      }
    }

    setPaying(false); onSaved?.(); onClose();
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const paidNum = parseFloat(partialAmount) || 0;
  const currentFullAmount = selectedRentRecord?.amount || selectedRecord?.amount;
  const isPartialPayment = currentFullAmount && paidNum > 0 && paidNum < currentFullAmount;
  const remaining = currentFullAmount ? currentFullAmount - paidNum : 0;
  const canConfirm = (payType === 'rent' && rentMonth && selectedRentRecord && partialAmount) ||
    ((payType === 'power' || payType === 'water') && selectedRecord && partialAmount);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>💰 Καταχώρηση Πληρωμής</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* Room */}
          <div className="space-y-2">
            <Label>Δωμάτιο</Label>
            <Select value={room} onValueChange={v => { setRoom(v); if (!preloaded) { setPayType(''); setSelectedRecord(null); setSelectedRentRecord(null); setUnpaidRentForMonth([]); }}}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε δωμάτιο" /></SelectTrigger>
              <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={String(r)}>{roomNames[r] || `Δωμάτιο ${r}`}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Type */}
          {room && (
            <div className="space-y-2">
              <Label>Τύπος Πληρωμής</Label>
              <Select value={payType} onValueChange={v => { setPayType(v); if (!preloaded) { setSelectedRecord(null); setSelectedRentRecord(null); setPartialAmount(''); setUnpaidRentForMonth([]); }}}>
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
                  <Select value={rentMonth} onValueChange={v => { setRentMonth(v); if (!preloaded) { setSelectedRentRecord(null); setUnpaidRentForMonth([]); setPartialAmount(''); }}}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Μήνας" /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={rentYear} onValueChange={v => { setRentYear(v); if (!preloaded) { setSelectedRentRecord(null); setUnpaidRentForMonth([]); setPartialAmount(''); }}}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* Selected rent record — preloaded or found */}
              {selectedRentRecord && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{selectedRentRecord.period}</p>
                        {selectedRentRecord.partial_notes && <p className="text-xs text-orange-600">{selectedRentRecord.partial_notes}</p>}
                      </div>
                      <span className="text-xl font-bold text-primary">€{selectedRentRecord.amount?.toFixed(2)}</span>
                    </div>
                    <Label className="text-xs">Ποσό πληρωμής</Label>
                    <Input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" autoFocus />
                    {isPartialPayment && (
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                        <p className="text-xs text-orange-700 font-medium">⚠️ Μερική — Υπόλοιπο: €{remaining.toFixed(2)}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Multiple records for month */}
              {rentMonth && !selectedRentRecord && unpaidRentForMonth.length > 1 && unpaidRentForMonth.map(record => (
                <Card key={record.id} className="cursor-pointer hover:bg-secondary/50"
                  onClick={() => { setSelectedRentRecord(record); setPartialAmount(String(record.amount)); }}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <p className="text-sm font-medium">{record.period}</p>
                    <Badge className="bg-red-100 text-red-700">€{record.amount?.toFixed(2)}</Badge>
                  </CardContent>
                </Card>
              ))}

              {rentMonth && !selectedRentRecord && unpaidRentForMonth.length === 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-3">
                  <p className="text-xs text-green-700">✓ Δεν υπάρχουν ανεξόφλητες οφειλές για αυτό τον μήνα</p>
                </div>
              )}
            </div>
          )}

          {/* POWER / WATER */}
          {(payType === 'power' || payType === 'water') && (
            <div className="space-y-2">
              {selectedRecord ? (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{selectedRecord.period}</p>
                        <p className="text-xs text-muted-foreground">{selectedRecord.usage} {payType === 'power' ? 'kWh' : 'm³'}</p>
                      </div>
                      <span className="text-xl font-bold text-primary">€{selectedRecord.amount?.toFixed(2)}</span>
                    </div>
                    <Label className="text-xs">Ποσό πληρωμής</Label>
                    <Input type="number" step="0.01" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} placeholder="0.00" autoFocus />
                    {isPartialPayment && (
                      <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200">
                        <p className="text-xs text-orange-700 font-medium">⚠️ Μερική — Υπόλοιπο: €{remaining.toFixed(2)}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                unpaidRecords.length === 0
                  ? <p className="text-sm text-muted-foreground text-center py-4">Δεν υπάρχουν ανεξόφλητες εγγραφές</p>
                  : unpaidRecords.map(record => (
                    <Card key={record.id}
                      className={`cursor-pointer transition-all ${selectedRecord?.id === record.id ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/50'}`}
                      onClick={() => { setSelectedRecord(record); setPartialAmount(String(record.amount)); }}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{record.period}</p>
                          <p className="text-xs text-muted-foreground">{record.usage} {payType === 'power' ? 'kWh' : 'm³'}</p>
                        </div>
                        <Badge className="bg-red-100 text-red-700">€{record.amount?.toFixed(2)}</Badge>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          )}

          {/* Confirm */}
          {canConfirm && (
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
