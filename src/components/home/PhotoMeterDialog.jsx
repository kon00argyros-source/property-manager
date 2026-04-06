import React, { useState, useRef, useEffect } from 'react';
import { db, supabase } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Input, Label, Button
} from '@/components/ui';
import { toast } from 'sonner';
import { Camera, Upload, CheckCircle, RefreshCw, Zap, Droplets, Loader2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const ROOMS = [1,2,3,4,5,6,7,8,9,10,11,12];
const MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];

// Call Claude Vision API to read meter
const readMeterFromImage = async (base64Image, mediaType) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image }
          },
          {
            type: 'text',
            text: 'This is a photo of a utility meter (electricity or water). Please read the meter display and return ONLY the numeric reading shown on the meter, with no units, no explanation, no text — just the number. If there are decimals shown after a comma or dot, include them. Example response: 1234.5'
          }
        ]
      }]
    })
  });
  const data = await response.json();
  const text = data.content?.[0]?.text?.trim() || '';
  // Extract number from response
  const match = text.match(/[\d]+([.,]\d+)?/);
  if (match) return parseFloat(match[0].replace(',', '.'));
  return null;
};

export default function PhotoMeterDialog({ open, onClose, onSaved }) {
  const [step, setStep] = useState('setup'); // setup | photo | confirm | saving
  const [room, setRoom] = useState('');
  const [meterType, setMeterType] = useState('');
  const [fromMonth, setFromMonth] = useState('');
  const [fromYear, setFromYear] = useState(String(new Date().getFullYear()));
  const [toMonth, setToMonth] = useState('');
  const [toYear, setToYear] = useState(String(new Date().getFullYear()));
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoMediaType, setPhotoMediaType] = useState('image/jpeg');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [readValue, setReadValue] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomNames, setRoomNames] = useState(roomNamesCache.get());
  const cameraRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { const unsub = roomNamesCache.subscribe(setRoomNames); return unsub; }, []);

  const reset = () => {
    setStep('setup'); setRoom(''); setMeterType(''); setFromMonth(''); setToMonth('');
    setPhotoBase64(null); setPhotoPreview(null); setReadValue(''); setReading(false); setSaving(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // Convert file to base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:image/jpeg;base64,....
      const base64 = result.split(',')[1];
      resolve({ base64, mediaType: file.type || 'image/jpeg' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true);
    setStep('photo');
    const { base64, mediaType } = await fileToBase64(file);
    setPhotoBase64(base64);
    setPhotoMediaType(mediaType);
    setPhotoPreview(URL.createObjectURL(file));

    // Call Claude Vision
    try {
      const value = await readMeterFromImage(base64, mediaType);
      if (value !== null) {
        setReadValue(String(value));
        toast.success(`Διαβάστηκε: ${value}`);
      } else {
        toast.error('Δεν ήταν δυνατή η ανάγνωση. Εισάγετε χειροκίνητα.');
        setReadValue('');
      }
    } catch (err) {
      console.error(err);
      toast.error('Σφάλμα κατά την ανάγνωση. Εισάγετε χειροκίνητα.');
      setReadValue('');
    }
    setReading(false);
    setStep('confirm');
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!readValue || isNaN(parseFloat(readValue))) { toast.error('Εισάγετε έγκυρο αριθμό'); return; }
    setSaving(true);
    setStep('saving');

    const roomNum = parseInt(room);
    const newMeasure = parseFloat(readValue);
    const entityName = meterType === 'power' ? 'PowerRecord' : 'WaterRecord';
    const unit = meterType === 'power' ? 'kWh' : 'm³';

    // Get previous measure
    const existing = await db[entityName].filter({ room_number: roomNum }, '-created_date', 1);
    const previousMeasure = existing.length > 0 ? existing[0].new_measure : 0;
    const usage = newMeasure - previousMeasure;

    if (usage < 0) {
      toast.error(`Η ένδειξη δεν μπορεί να είναι μικρότερη από την προηγούμενη (${previousMeasure})`);
      setSaving(false); setStep('confirm'); return;
    }

    // Get price
    const settings = await db.AppSettings.list();
    const price = meterType === 'power' ? (settings[0]?.power_price || 0) : (settings[0]?.water_price || 0);
    const amount = usage * price;
    const period = `${fromMonth}/${fromYear} - ${toMonth}/${toYear}`;

    // Upload photo to Supabase Storage
    let photoUrl = null;
    if (photoBase64) {
      try {
        const blob = await fetch(`data:${photoMediaType};base64,${photoBase64}`).then(r => r.blob());
        const fileName = `room-${roomNum}/meter_${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('room-files')
          .upload(fileName, blob, { contentType: photoMediaType });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('room-files').getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      } catch (err) { console.error('Photo upload error:', err); }
    }

    // Create record
    await db[entityName].create({
      room_number: roomNum,
      period,
      previous_measure: previousMeasure,
      new_measure: newMeasure,
      usage,
      amount,
      is_paid: false,
      photo_url: photoUrl,
    });

    toast.success(`Καταχωρήθηκε: ${usage} ${unit} = €${amount.toFixed(2)}`);
    onSaved?.();
    handleClose();
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const canProceed = room && meterType && fromMonth && toMonth;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Καταχώρηση με Φωτογραφία
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Setup */}
        {(step === 'setup' || step === 'photo') && (
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
            <div className="space-y-2">
              <Label>Τύπος Μετρητή</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMeterType('power')}
                  className={cn("flex items-center gap-2 p-3 rounded-xl border-2 transition-all font-medium text-sm",
                    meterType === 'power' ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400" : "border-border hover:border-yellow-300")}
                >
                  <Zap className="w-5 h-5" /> Ρεύμα
                </button>
                <button
                  onClick={() => setMeterType('water')}
                  className={cn("flex items-center gap-2 p-3 rounded-xl border-2 transition-all font-medium text-sm",
                    meterType === 'water' ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "border-border hover:border-blue-300")}
                >
                  <Droplets className="w-5 h-5" /> Νερό
                </button>
              </div>
            </div>

            {/* Period From */}
            <div className="space-y-2">
              <Label>Περίοδος Από</Label>
              <div className="flex gap-2">
                <Select value={fromMonth} onValueChange={setFromMonth}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Μήνας" /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={fromYear} onValueChange={setFromYear}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Period To */}
            <div className="space-y-2">
              <Label>Περίοδος Έως</Label>
              <div className="flex gap-2">
                <Select value={toMonth} onValueChange={setToMonth}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Μήνας" /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={toYear} onValueChange={setToYear}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Camera button */}
            {canProceed && (
              <div className="pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoCapture}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={reading}
                  className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all"
                >
                  {reading ? (
                    <><Loader2 className="w-10 h-10 text-primary animate-spin" /><span className="text-sm font-medium text-primary">Ανάγνωση μετρητή...</span></>
                  ) : (
                    <><Camera className="w-10 h-10 text-primary" /><span className="text-sm font-medium text-primary">Φωτογράφηση Μετρητή</span><span className="text-xs text-muted-foreground">Ή επιλογή από gallery</span></>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Confirm reading */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {/* Photo preview */}
            {photoPreview && (
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={photoPreview} alt="Μετρητής" className="w-full max-h-48 object-contain bg-black" />
              </div>
            )}

            <div className={cn(
              "p-4 rounded-xl border-2",
              readValue ? "border-green-400 bg-green-50 dark:bg-green-900/20" : "border-orange-400 bg-orange-50 dark:bg-orange-900/20"
            )}>
              <p className="text-sm font-medium mb-1">
                {readValue ? '✓ Διαβάστηκε η ένδειξη:' : '⚠️ Δεν διαβάστηκε αυτόματα. Εισάγετε χειροκίνητα:'}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={readValue}
                  onChange={e => setReadValue(e.target.value)}
                  placeholder="π.χ. 1234.5"
                  className="text-xl font-bold"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground shrink-0">
                  {meterType === 'power' ? 'kWh' : 'm³'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Ελέγξτε και διορθώστε αν χρειάζεται</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep('setup'); setPhotoPreview(null); setPhotoBase64(null); setReadValue(''); }} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" /> Νέα Φωτο
              </Button>
              <Button onClick={handleSave} disabled={saving || !readValue} className="flex-1 bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" /> Επιβεβαίωση
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Saving */}
        {step === 'saving' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Αποθήκευση καταχώρησης και φωτογραφίας...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
