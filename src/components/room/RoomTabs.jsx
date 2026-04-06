import React, { useState, useEffect, useRef } from 'react';
import { db, supabase } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, parse, isValid } from 'date-fns';
import { el } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, Label, Textarea } from '@/components/ui';
import UtilityRecordCard from './UtilityRecordCard';
import {
  Zap, Droplets, Banknote, Calendar, StickyNote,
  Plus, X, Save, User, Phone, Euro, Tag,
  Trash2, Upload, FileText, Download, File,
  ImageIcon, FileArchive, ChevronLeft, ChevronRight
} from 'lucide-react';

// ─── PowerTab ────────────────────────────────────────────────────────────────
export function PowerTab({ roomNumber, refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => db.PowerRecord.filter({ room_number: roomNumber }, '-created_date').then(r => { setRecords(r); setLoading(false); });
  useEffect(() => { load(); }, [roomNumber, refreshKey]);
  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (records.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Zap className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-sm">Δεν υπάρχουν καταχωρήσεις ρεύματος</p>
      <p className="text-xs mt-1">Προσθέστε ένδειξη με το κουμπί +</p>
    </div>
  );
  return <div className="space-y-3">{records.map(r => <UtilityRecordCard key={r.id} record={r} unit="kWh" onDeleted={load} />)}</div>;
}

// ─── WaterTab ────────────────────────────────────────────────────────────────
export function WaterTab({ roomNumber, refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = () => db.WaterRecord.filter({ room_number: roomNumber }, '-created_date').then(r => { setRecords(r); setLoading(false); });
  useEffect(() => { load(); }, [roomNumber, refreshKey]);
  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (records.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Droplets className="w-12 h-12 mb-4 opacity-30" />
      <p className="text-sm">Δεν υπάρχουν καταχωρήσεις νερού</p>
      <p className="text-xs mt-1">Προσθέστε ένδειξη με το κουμπί +</p>
    </div>
  );
  return <div className="space-y-3">{records.map(r => <UtilityRecordCard key={r.id} record={r} unit="m³" onDeleted={load} />)}</div>;
}

// ─── RentTab ─────────────────────────────────────────────────────────────────
const MONTH_NAMES_GR = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
const MONTH_NAMES_FULL = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];

export function RentTab({ roomNumber, refreshKey }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  // Show last 12 months as tabs, current month selected
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1); // 1-12

  useEffect(() => {
    db.RentPayment.filter({ room_number: roomNumber }, '-created_date').then(r => { setRecords(r); setLoading(false); });
  }, [roomNumber, refreshKey]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  // Build last 12 months for tabs
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  // Find records for selected month/year
  const selectedRecords = records.filter(r => {
    // Match period like "3/2026" or "3/2026 (υπόλοιπο)"
    const period = r.period || '';
    return period.startsWith(`${selectedMonth}/${selectedYear}`);
  });

  const isSelected = (m) => m.month === selectedMonth && m.year === selectedYear;
  const hasUnpaid = (m) => records.some(r => (r.period || '').startsWith(`${m.month}/${m.year}`) && !r.is_paid);
  const hasPaid = (m) => records.some(r => (r.period || '').startsWith(`${m.month}/${m.year}`) && r.is_paid);
  const hasAny = (m) => records.some(r => (r.period || '').startsWith(`${m.month}/${m.year}`));

  return (
    <div className="space-y-4">
      {/* Month tabs - scrollable */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-2 min-w-max">
          {months.map((m) => (
            <button
              key={`${m.month}-${m.year}`}
              onClick={() => { setSelectedMonth(m.month); setSelectedYear(m.year); }}
              className={cn(
                "flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all border min-w-[56px]",
                isSelected(m)
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border hover:bg-secondary/60"
              )}
            >
              <span>{MONTH_NAMES_GR[m.month - 1]}</span>
              <span className="opacity-70">{String(m.year).slice(2)}</span>
              <div className="mt-1 flex gap-0.5">
                {hasUnpaid(m) && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
                {hasPaid(m) && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                {!hasAny(m) && <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected month title */}
      <h3 className="text-sm font-semibold text-muted-foreground">
        {MONTH_NAMES_FULL[selectedMonth - 1]} {selectedYear}
      </h3>

      {/* Records for selected month */}
      {selectedRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Banknote className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm">Δεν υπάρχουν εγγραφές για αυτό τον μήνα</p>
        </div>
      ) : (
        <div className="space-y-3">
          {selectedRecords.map(record => (
            <Card key={record.id} className={cn("border-l-4", record.is_paid ? "border-l-green-500" : "border-l-red-500")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{record.period}</p>
                  <div className="text-right">
                    <p className="font-semibold">€{record.amount?.toFixed(2)}</p>
                    {record.original_amount && record.original_amount !== record.amount && (
                      <p className="text-xs text-muted-foreground">από €{record.original_amount?.toFixed(2)}</p>
                    )}
                    <Badge variant="secondary" className={cn("text-xs mt-1", record.is_paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                      {record.is_paid ? '✓ Εξοφλήθηκε' : '✗ Ανεξόφλητο'}
                    </Badge>
                  </div>
                </div>
                {record.partial_notes && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 bg-orange-50 dark:bg-orange-900/20 rounded p-2">{record.partial_notes}</p>
                )}
                {record.is_paid && record.paid_date && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                    <Calendar className="w-3 h-3" /> Πληρώθηκε {record.paid_date}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* All records summary */}
      {records.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Σύνοψη</p>
          <div className="flex gap-4 text-xs">
            <span className="text-red-600">Ανεξόφλητα: <strong>€{records.filter(r => !r.is_paid).reduce((s, r) => s + (r.amount || 0), 0).toFixed(2)}</strong></span>
            <span className="text-green-600">Εξοφλημένα: <strong>€{records.filter(r => r.is_paid).reduce((s, r) => s + (r.amount || 0), 0).toFixed(2)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NotesTab ────────────────────────────────────────────────────────────────
export function NotesTab({ roomNumber, refreshKey }) {
  const [notes, setNotes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => db.RoomNote.filter({ room_number: roomNumber }, '-created_date').then(r => { setNotes(r); setLoading(false); });
  useEffect(() => { load(); }, [roomNumber, refreshKey]);

  const handleAdd = async () => {
    if (!noteText.trim()) return;
    await db.RoomNote.create({ room_number: roomNumber, text: noteText });
    setNoteText(''); setShowForm(false);
    load();
    toast.success('Η σημείωση αποθηκεύτηκε');
  };

  const handleDelete = async (id) => {
    if (deletingId !== id) { setDeletingId(id); setTimeout(() => setDeletingId(null), 3000); return; }
    await db.RoomNote.delete(id);
    load();
    setDeletingId(null);
    toast.success('Η σημείωση διαγράφηκε');
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          {showForm ? <><X className="w-4 h-4 mr-1" />Ακύρωση</> : <><Plus className="w-4 h-4 mr-1" />Νέα Σημείωση</>}
        </Button>
      </div>
      {showForm && (
        <Card><CardContent className="p-4 space-y-3">
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Γράψτε τη σημείωσή σας..." rows={4} />
          <Button onClick={handleAdd} size="sm">Αποθήκευση</Button>
        </CardContent></Card>
      )}
      {notes.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <StickyNote className="w-12 h-12 mb-4 opacity-30" /><p className="text-sm">Δεν υπάρχουν σημειώσεις</p>
        </div>
      ) : notes.map(note => (
        <Card key={note.id}><CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm whitespace-pre-wrap flex-1">{note.text}</p>
            <button
              onClick={() => handleDelete(note.id)}
              className={cn(
                "shrink-0 p-1.5 rounded-lg transition-all",
                deletingId === note.id
                  ? "bg-red-500 text-white animate-pulse text-xs px-2"
                  : "text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              )}
            >
              {deletingId === note.id ? 'Σίγουρα;' : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{format(new Date(note.created_date), 'dd/MM/yyyy · HH:mm')}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}

// ─── FilesTab ─────────────────────────────────────────────────────────────────
const getFileIcon = (name) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (['pdf'].includes(ext)) return <FileText className="w-5 h-5 text-red-500" />;
  if (['zip','rar','7z'].includes(ext)) return <FileArchive className="w-5 h-5 text-yellow-500" />;
  return <File className="w-5 h-5 text-gray-500" />;
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export function FilesTab({ roomNumber, refreshKey }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState(null);
  const fileInputRef = useRef(null);
  const folder = `room-${roomNumber}`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.storage.from('room-files').list(folder, { sortBy: { column: 'created_at', order: 'desc' } });
    if (error) { console.error(error); setLoading(false); return; }
    setFiles(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [roomNumber, refreshKey]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path = `${folder}/${safeName}`;
    const { error } = await supabase.storage.from('room-files').upload(path, file);
    if (error) { toast.error('Σφάλμα κατά την ανάρτηση'); console.error(error); }
    else { toast.success(`Το αρχείο "${file.name}" ανέβηκε`); load(); }
    setUploading(false);
    e.target.value = '';
  };

  const handleDownload = async (fileName) => {
    const { data } = supabase.storage.from('room-files').getPublicUrl(`${folder}/${fileName}`);
    window.open(data.publicUrl, '_blank');
  };

  const handleDelete = async (fileName) => {
    if (deletingPath !== fileName) {
      setDeletingPath(fileName);
      setTimeout(() => setDeletingPath(null), 3000);
      return;
    }
    const { error } = await supabase.storage.from('room-files').remove([`${folder}/${fileName}`]);
    if (error) { toast.error('Σφάλμα κατά τη διαγραφή'); }
    else { toast.success('Το αρχείο διαγράφηκε'); load(); }
    setDeletingPath(null);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex justify-end">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Ανάρτηση...' : 'Ανέβασμα Αρχείου'}
        </Button>
      </div>

      {/* Drop zone when empty */}
      {files.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-secondary/30 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-sm font-medium">Δεν υπάρχουν αρχεία</p>
          <p className="text-xs mt-1">Κλικ για ανέβασμα αρχείου</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <Card key={file.name}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="shrink-0">{getFileIcon(file.name)}</div>
                <div className="flex-1 min-w-0">
                  {/* Remove timestamp prefix for display */}
                  <p className="text-sm font-medium truncate">{file.name.replace(/^\d+_/, '')}</p>
                  {file.metadata?.size && (
                    <p className="text-xs text-muted-foreground">{formatBytes(file.metadata.size)}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(file.name)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                    title="Άνοιγμα/Λήψη"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(file.name)}
                    className={cn(
                      "p-2 rounded-lg transition-all text-xs",
                      deletingPath === file.name
                        ? "bg-red-500 text-white animate-pulse px-3"
                        : "text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    )}
                  >
                    {deletingPath === file.name ? 'Σίγουρα;' : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── RoomInfoTab ─────────────────────────────────────────────────────────────
export function RoomInfoTab({ room, onUpdate }) {
  const [form, setForm] = useState({ room_name: '', first_name: '', last_name: '', phone: '', rent_amount: 0 });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (room) setForm({ room_name: room.room_name || '', first_name: room.first_name || '', last_name: room.last_name || '', phone: room.phone || '', rent_amount: room.rent_amount || 0 });
  }, [room]);
  const handleSave = async () => {
    setSaving(true);
    if (room?.id) { await db.Room.update(room.id, form); await roomNamesCache.load(); }
    toast.success('Οι αλλαγές αποθηκεύτηκαν');
    onUpdate();
    setSaving(false);
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Tag className="w-5 h-5 text-primary" /> Όνομα Δωματίου</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Προσαρμοσμένο Όνομα</Label>
            <Input value={form.room_name} onChange={e => setForm({ ...form, room_name: e.target.value })} placeholder={`Δωμάτιο ${room?.room_number} (προεπιλογή)`} />
            <p className="text-xs text-muted-foreground">Αφήστε κενό για "Δωμάτιο {room?.room_number}"</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><User className="w-5 h-5 text-primary" /> Στοιχεία Ενοίκου</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Όνομα</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="Εισάγετε όνομα" /></div>
            <div className="space-y-2"><Label>Επώνυμο</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Εισάγετε επώνυμο" /></div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Phone className="w-4 h-4" /> Τηλέφωνο</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Εισάγετε τηλέφωνο" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Euro className="w-5 h-5 text-primary" /> Ενοίκιο</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Μηνιαίο Ενοίκιο (€)</Label>
            <Input type="number" value={form.rent_amount} onChange={e => setForm({ ...form, rent_amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
          </div>
        </CardContent>
      </Card>
      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="w-4 h-4 mr-2" />{saving ? 'Αποθήκευση...' : 'Αποθήκευση Αλλαγών'}
      </Button>
    </div>
  );
}
