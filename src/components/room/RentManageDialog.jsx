import React, { useState } from 'react';
import { db } from '@/lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { toast } from 'sonner';
import { format } from 'date-fns';

const MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];

export default function RentManageDialog({ open, onClose, roomNumber, record, onSaved }) {
  const isEdit = !!record;
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  const [month, setMonth] = useState(() => {
    if (record?.period) return record.period.split('/')[0] || String(new Date().getMonth() + 1);
    return String(new Date().getMonth() + 1);
  });
  const [year, setYear] = useState(() => {
    if (record?.period) return record.period.split('/')[1]?.split(' ')[0] || String(currentYear);
    return String(currentYear);
  });
  const [amount, setAmount] = useState(record?.amount?.toString() || '');
  const [isPaid, setIsPaid] = useState(record?.is_paid || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) { toast.error('Εισάγετε έγκυρο ποσό'); return; }
    setSaving(true);
    const today = format(new Date(), 'dd/MM/yyyy');
    const period = `${month}/${year}`;
    if (isEdit) {
      await db.RentPayment.update(record.id, {
        amount: parseFloat(amount), is_paid: isPaid,
        paid_date: isPaid ? (record.paid_date || today) : null, period,
      });
      toast.success('Η εγγραφή ενημερώθηκε');
    } else {
      await db.RentPayment.create({
        room_number: roomNumber, period, amount: parseFloat(amount),
        is_paid: isPaid, paid_date: isPaid ? today : null,
      });
      toast.success('Η εγγραφή δημιουργήθηκε');
    }
    onSaved?.(); onClose(); setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? '✏️ Επεξεργασία' : '➕ Νέα Εγγραφή'} Ενοικίου</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Μήνας</Label>
            <div className="flex gap-2">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ποσό (€)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer" onClick={() => setIsPaid(!isPaid)}>
            <div className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${isPaid ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPaid ? 'left-6' : 'left-0.5'}`} />
            </div>
            <span className="text-sm font-medium">{isPaid ? '✓ Εξοφλήθηκε' : '✗ Ανεξόφλητο'}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Ακύρωση</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
