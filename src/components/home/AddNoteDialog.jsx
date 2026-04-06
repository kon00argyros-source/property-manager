import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, Label, Button } from '@/components/ui';
import { toast } from 'sonner';

const ROOMS = [1,2,3,4,5,6,7,8,9,10,11,12];

export default function AddNoteDialog({ open, onClose, onSaved }) {
  const [room, setRoom] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [roomNames, setRoomNames] = useState(roomNamesCache.get());

  useEffect(() => { const unsub = roomNamesCache.subscribe(setRoomNames); return unsub; }, []);

  const handleSubmit = async () => {
    if (!room || !text.trim()) { toast.error('Επιλέξτε δωμάτιο και γράψτε σημείωση'); return; }
    setSaving(true);
    await db.RoomNote.create({ room_number: parseInt(room), text: text.trim() });
    toast.success('Η σημείωση αποθηκεύτηκε');
    onSaved?.();
    onClose();
    setRoom(''); setText(''); setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>✏️ Νέα Σημείωση</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Δωμάτιο</Label>
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε δωμάτιο" /></SelectTrigger>
              <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={String(r)}>{roomNames[r] || `Δωμάτιο ${r}`}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Σημείωση</Label>
            <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Γράψτε τη σημείωσή σας..." rows={4} />
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
