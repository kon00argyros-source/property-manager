import React, { useState, useEffect, useRef } from 'react';
import { db, supabase } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { readMeterFromImage } from '@/lib/meterReader';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Input, Label, Button
} from '@/components/ui';
import { toast } from 'sonner';
import { Camera, ImageIcon, Loader2, CheckCircle, RefreshCw, Zap, Droplets, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROOMS = [1,2,3,4,5,6,7,8,9,10,11,12];
const MONTHS_GR = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
const MONTHS_SHORT = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];

const getLastRecordDate = async (entityName, roomNum) => {
  const records = await db[entityName].filter({ room_number: roomNum }, '-created_date', 1);
  if (records.length === 0) return null;
  const period = records[0].period || '';
  const parts = period.split(' - ');
  const lastPart = parts[parts.length - 1].replace(/\s*\(.*\)/, '').trim();
  const [m, y] = lastPart.split('/');
  if (m && y && !isNaN(parseInt(m)) && !isNaN(parseInt(y))) {
    return { month: parseInt(m), year: parseInt(y) };
  }
  return null;
};

export default function AddUtilityDialog({ open, onClose, type, onSaved }) {
  const [mode, setMode] = useState('choose');
  const [room, setRoom] = useState('');
  const [fromMonth, setFromMonth] = useState('');
  const [fromYear, setFromYear] = useState(String(new Date().getFullYear()));
  const [toMonth, setToMonth] = useState(String(new Date().getMonth() + 1));
  const [toYear, setToYear] = useState(String(new Date().getFullYear()));
  const [autoFromLabel, setAutoFromLabel] = useState('');
  const [newEntry, setNewEntry] = useState('');
  const [saving, setSaving] = useState(false);
  const [roomNames, setRoomNames] = useState(roomNamesCache.get());

  // Photo states
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMediaType, setPhotoMediaType] = useState('image/jpeg');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState(null); // { value, confidence, notes }
  const [readValue, setReadValue] = useState('');
  const [photoStep, setPhotoStep] = useState('capture');

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => { const unsub = roomNamesCache.subscribe(setRoomNames); return unsub; }, []);

  useEffect(() => {
    if (!room || !type) return;
    const entityName = type === 'power' ? 'PowerRecord' : 'WaterRecord';
    getLastRecordDate(entityName, parseInt(room)).then(last => {
      if (last) {
        setFromMonth(String(last.month));
        setFromYear(String(last.year));
        setAutoFromLabel(`Από τελευταία καταχώρηση: ${MONTHS_SHORT[last.month - 1]} ${last.year}`);
      } else {
        setFromMonth(String(new Date().getMonth() + 1));
        setFromYear(String(new Date().getFullYear()));
        setAutoFromLabel('Πρώτη καταχώρηση');
      }
    });
  }, [room, type]);

  const isPower = type === 'power';
  const entityName = isPower ? 'PowerRecord' : 'WaterRecord';
  const unit = isPower ? 'kWh' : 'm³';

  const reset = () => {
    setMode('choose'); setRoom(''); setNewEntry(''); setSaving(false);
    setPhotoBase64(null); setPhotoPreview(null); setReadValue(''); setReadResult(null);
    setReading(false); setPhotoStep('capture'); setAutoFromLabel('');
    setToMonth(String(new Date().getMonth() + 1));
    setToYear(String(new Date().getFullYear()));
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePhotoFile = async (file) => {
    if (!file) return;
    setReading(true);
    setPhotoStep('confirm');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const mediaType = file.type || 'image/jpeg';
      setPhotoBase64(base64);
      setPhotoMediaType(mediaType);
      setPhotoPreview(URL.createObjectURL(file));

      try {
        const result = await readMeterFromImage(base64, mediaType);
        setReadResult(result);
        if (result.value !== null) {
          setReadValue(String(result.value));
          if (result.confidence === 'high') toast.success(`✓ Διαβάστηκε: ${result.value}`);
          else toast(`Ένδειξη: ${result.value} — ελέγξτε την`, { icon: '⚠️' });
        } else {
          setReadValue('');
          toast.error('Δεν αναγνωρίστηκε. Εισάγετε χειροκίνητα.');
        }
      } catch (err) {
        console.error(err);
        setReadValue('');
        toast.error('Σφάλμα ανάγνωσης.');
      }
      setReading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (valueToSave, photoB64 = null, photoMime = null) => {
    if (!room || !fromMonth || !toMonth) { toast.error('Συμπληρώστε όλα τα πεδία'); return; }
    const val = parseFloat(String(valueToSave).replace(',', '.'));
    if (isNaN(val)) { toast.error('Εισάγετε έγκυρο αριθμό'); return; }
    setSaving(true);

    const roomNum = parseInt(room);
    const existing = await db[entityName].filter({ room_number: roomNum }, '-created_date', 1);
    const previousMeasure = existing.length > 0 ? existing[0].new_measure : 0;
    const usage = val - previousMeasure;

    if (usage < 0) {
      toast.error(`Η ένδειξη (${val}) δεν μπορεί να είναι μικρότερη από την προηγούμενη (${previousMeasure})`);
      setSaving(false); return;
    }

    const settings = await db.AppSettings.list();
    const price = isPower ? (settings[0]?.power_price || 0) : (settings[0]?.water_price || 0);
    const amount = usage * price;
    const period = `${fromMonth}/${fromYear} - ${toMonth}/${toYear}`;

    let photoUrl = null;
    if (photoB64) {
      try {
        const blob = await fetch(`data:${photoMime};base64,${photoB64}`).then(r => r.blob());
        const fileName = `room-${roomNum}/meter_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('room-files').upload(fileName, blob, { contentType: photoMime });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('room-files').getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      } catch (err) { console.error('Photo upload error:', err); }
    }

    await db[entityName].create({ room_number: roomNum, period, previous_measure: previousMeasure, new_measure: val, usage, amount, is_paid: false, photo_url: photoUrl });
    toast.success(`Καταχωρήθηκε: ${usage} ${unit} = €${amount.toFixed(2)}`);
    onSaved?.();
    handleClose();
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const confidenceColor = readResult?.confidence === 'high'
    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
    : readResult?.confidence === 'medium'
    ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    : 'border-orange-400 bg-orange-50 dark:bg-orange-900/20';

  const confidenceLabel = readResult?.confidence === 'high' ? '✓ Υψηλή εμπιστοσύνη' :
    readResult?.confidence === 'medium' ? '⚠️ Μέτρια εμπιστοσύνη — ελέγξτε' : '⚠️ Χαμηλή εμπιστοσύνη — ελέγξτε';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPower ? <Zap className="w-5 h-5 text-yellow-500" /> : <Droplets className="w-5 h-5 text-blue-500" />}
            Νέα Καταχώρηση {isPower ? 'Ρεύματος' : 'Νερού'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Room */}
          <div className="space-y-2">
            <Label>Δωμάτιο</Label>
            <Select value={room} onValueChange={setRoom}>
              <SelectTrigger><SelectValue placeholder="Επιλέξτε δωμάτιο" /></SelectTrigger>
              <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={String(r)}>{roomNames[r] || `Δωμάτιο ${r}`}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Auto-detected period */}
          {room && autoFromLabel && (
            <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">📅 Περίοδος</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Από</p>
                  <div className="flex gap-1">
                    <Select value={fromMonth} onValueChange={setFromMonth}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{MONTHS_GR.map((m,i) => <SelectItem key={i} value={String(i+1)}>{MONTHS_SHORT[i]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={fromYear} onValueChange={setFromYear}>
                      <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <span className="text-muted-foreground mt-4">→</span>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Έως</p>
                  <div className="flex gap-1">
                    <Select value={toMonth} onValueChange={setToMonth}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{MONTHS_GR.map((m,i) => <SelectItem key={i} value={String(i+1)}>{MONTHS_SHORT[i]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={toYear} onValueChange={setToYear}>
                      <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <p className="text-xs text-primary">{autoFromLabel}</p>
            </div>
          )}

          {/* Mode chooser */}
          {room && mode === 'choose' && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setMode('manual')}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all">
                <Pencil className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-center">Χειροκίνητη<br/>Εισαγωγή</span>
              </button>
              <button onClick={() => setMode('photo')}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-border hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                <Camera className="w-8 h-8 text-rose-500" />
                <span className="text-sm font-medium text-center">Φωτογραφία<br/>Μετρητή</span>
              </button>
            </div>
          )}

          {/* Manual */}
          {room && mode === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Νέα Ένδειξη ({unit})</Label>
                <Input type="number" value={newEntry} onChange={e => setNewEntry(e.target.value)}
                  placeholder={`π.χ. 1234`} autoFocus />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('choose')} className="flex-1">Πίσω</Button>
                <Button onClick={() => handleSave(newEntry)} disabled={saving || !newEntry} className="flex-1">
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Αποθήκευση...</> : 'Καταχώρηση'}
                </Button>
              </div>
            </div>
          )}

          {/* Photo - capture step */}
          {room && mode === 'photo' && photoStep === 'capture' && (
            <div className="space-y-3">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { handlePhotoFile(e.target.files?.[0]); e.target.value=''; }} />
              <input ref={galleryRef} type="file" accept="image/*" className="hidden"
                onChange={e => { handlePhotoFile(e.target.files?.[0]); e.target.value=''; }} />

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">💡 Συμβουλή</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Φωτογραφίστε κατ' ευθείαν τα ψηφία του μετρητή. Βεβαιωθείτε ότι υπάρχει καλός φωτισμός και η εικόνα είναι καθαρή.</p>
              </div>

              <button onClick={() => cameraRef.current?.click()}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-rose-400 bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-all">
                <Camera className="w-9 h-9 text-rose-500 shrink-0" />
                <div className="text-left">
                  <p className="font-medium text-rose-700 dark:text-rose-400">Φωτογράφηση Τώρα</p>
                  <p className="text-xs text-rose-600/70">Ανοίγει η κάμερα</p>
                </div>
              </button>

              <button onClick={() => galleryRef.current?.click()}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all">
                <ImageIcon className="w-9 h-9 text-blue-500 shrink-0" />
                <div className="text-left">
                  <p className="font-medium text-blue-700 dark:text-blue-400">Από Gallery</p>
                  <p className="text-xs text-blue-600/70">Επιλογή υπάρχουσας φωτογραφίας</p>
                </div>
              </button>

              <Button variant="outline" onClick={() => setMode('choose')} className="w-full">Πίσω</Button>
            </div>
          )}

          {/* Reading in progress */}
          {room && mode === 'photo' && photoStep === 'confirm' && reading && (
            <div className="space-y-4">
              {photoPreview && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={photoPreview} alt="Μετρητής" className="w-full max-h-52 object-contain bg-black" />
                </div>
              )}
              <div className="flex flex-col items-center py-6 gap-3">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm font-medium">Ανάλυση μετρητή με AI...</p>
                <p className="text-xs text-muted-foreground">Αναγνώριση ψηφίων μετρητή</p>
              </div>
            </div>
          )}

          {/* Confirm reading */}
          {room && mode === 'photo' && photoStep === 'confirm' && !reading && (
            <div className="space-y-4">
              {photoPreview && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={photoPreview} alt="Μετρητής" className="w-full max-h-52 object-contain bg-black" />
                </div>
              )}

              <div className={cn("p-4 rounded-xl border-2", readResult?.value !== null ? confidenceColor : 'border-orange-400 bg-orange-50 dark:bg-orange-900/20')}>
                {readResult?.value !== null ? (
                  <>
                    <p className="text-xs font-medium mb-1 opacity-70">{confidenceLabel}</p>
                    {readResult?.notes && <p className="text-xs text-muted-foreground mb-2 italic">{readResult.notes}</p>}
                  </>
                ) : (
                  <p className="text-sm font-medium mb-2">⚠️ Δεν αναγνωρίστηκε — εισάγετε χειροκίνητα:</p>
                )}
                <div className="flex items-center gap-2">
                  <Input type="number" value={readValue} onChange={e => setReadValue(e.target.value)}
                    placeholder="π.χ. 9763" className="text-xl font-bold" autoFocus />
                  <span className="text-sm text-muted-foreground shrink-0">{unit}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Ελέγξτε και διορθώστε αν χρειάζεται</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setPhotoStep('capture'); setPhotoPreview(null); setPhotoBase64(null); setReadValue(''); setReadResult(null); }} className="flex-1">
                  <RefreshCw className="w-4 h-4 mr-1" /> Νέα φωτο
                </Button>
                <Button onClick={() => handleSave(readValue, photoBase64, photoMediaType)}
                  disabled={saving || !readValue} className="flex-1 bg-green-600 hover:bg-green-700">
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Επιβεβαίωση
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
