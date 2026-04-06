import React, { useState, useRef } from 'react';
import { db, supabase } from '@/lib/db';
import { readMeterFromImage } from '@/lib/meterReader';
import { Card, CardContent, Badge } from '@/components/ui';
import { ChevronDown, ChevronUp, Calendar, Trash2, Camera, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';


export default function UtilityRecordCard({ record, unit, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(record.photo_url || null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const photoInputRef = useRef(null);

  const entityName = unit === 'kWh' ? 'PowerRecord' : 'WaterRecord';

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3000); return; }
    await db[entityName].delete(record.id);
    toast.success('Η εγγραφή διαγράφηκε');
    onDeleted?.();
  };

  const handleAddPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const mediaType = file.type || 'image/jpeg';

      // Upload to storage
      try {
        const blob = await fetch(`data:${mediaType};base64,${base64}`).then(r => r.blob());
        const folder = `room-${record.room_number}`;
        const fileName = `${folder}/meter_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('room-files').upload(fileName, blob, { contentType: mediaType });

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('room-files').getPublicUrl(fileName);
          const url = urlData.publicUrl;
          await db[entityName].update(record.id, { photo_url: url });
          setPhotoUrl(url);
          toast.success('Η φωτογραφία αποθηκεύτηκε');
        } else {
          toast.error('Σφάλμα κατά την αποθήκευση φωτογραφίας');
        }
      } catch (err) {
        console.error(err);
        toast.error('Σφάλμα');
      }
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <Card className={cn("transition-all hover:shadow-md border-l-4", record.is_paid ? "border-l-green-500" : "border-l-red-500")}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <p className="font-medium text-sm">{record.period}</p>
            <p className="text-muted-foreground text-xs mt-1">{record.usage} {unit} χρήση</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="font-semibold">€{record.amount?.toFixed(2)}</p>
              <Badge variant="secondary" className={cn("text-xs mt-1", record.is_paid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                {record.is_paid ? 'Εξοφλήθηκε' : 'Ανεξόφλητο'}
              </Badge>
            </div>

            {/* Photo indicator */}
            {photoUrl && (
              <button onClick={(e) => { e.stopPropagation(); setShowPhotoPreview(!showPhotoPreview); }}
                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all" title="Προβολή φωτογραφίας">
                <ImageIcon className="w-4 h-4" />
              </button>
            )}

            {/* Add photo button */}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleAddPhoto} />
            <button
              onClick={(e) => { e.stopPropagation(); photoInputRef.current?.click(); }}
              disabled={uploadingPhoto}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
              title={photoUrl ? "Αντικατάσταση φωτογραφίας" : "Προσθήκη φωτογραφίας"}
            >
              {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </button>

            {/* Delete */}
            <button onClick={handleDelete}
              className={cn("p-1.5 rounded-lg transition-all text-xs",
                confirming ? "bg-red-500 text-white animate-pulse px-2" : "text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20")}
              title="Διαγραφή">
              {confirming ? 'Σίγουρα;' : <Trash2 className="w-4 h-4" />}
            </button>

            {/* Expand */}
            <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {/* Photo preview */}
        {showPhotoPreview && photoUrl && (
          <div className="mt-3 rounded-xl overflow-hidden border border-border">
            <img src={photoUrl} alt="Φωτογραφία μετρητή" className="w-full max-h-48 object-contain bg-black cursor-pointer"
              onClick={() => window.open(photoUrl, '_blank')} />
            <p className="text-xs text-center text-muted-foreground py-1 bg-muted/30">Κλικ για πλήρη προβολή</p>
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Προηγούμενη ένδειξη</span>
              <span className="font-medium">{record.previous_measure} {unit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Νέα ένδειξη</span>
              <span className="font-medium">{record.new_measure} {unit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Κατανάλωση</span>
              <span className="font-medium">{record.usage} {unit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ποσό</span>
              <span className="font-semibold">€{record.amount?.toFixed(2)}</span>
            </div>
            {record.is_paid && record.paid_date && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Πληρώθηκε</span>
                <span className="font-medium text-green-600">{record.paid_date}</span>
              </div>
            )}
            {photoUrl && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Camera className="w-3 h-3" /> Φωτογραφία</span>
                <button onClick={() => window.open(photoUrl, '_blank')} className="text-blue-500 hover:underline text-xs">Προβολή</button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
