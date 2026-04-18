import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { ArrowLeft, Share2, Zap, Droplets, Banknote, Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export default function RoomStatus() {
  const { roomNumber } = useParams();
  const num = parseInt(roomNumber);
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [unpaidPower, setUnpaidPower] = useState([]);
  const [unpaidWater, setUnpaidWater] = useState([]);
  const [unpaidRent, setUnpaidRent] = useState([]);
  const [loading, setLoading] = useState(true);
  const statusRef = useRef(null);

  useEffect(() => { loadData(); }, [num]);

  const loadData = async () => {
    setLoading(true);
    const rooms = await db.Room.filter({ room_number: num });
    setRoom(rooms[0] || null);
    const [power, water, rent] = await Promise.all([
      db.PowerRecord.filter({ room_number: num, is_paid: false }, '-created_date'),
      db.WaterRecord.filter({ room_number: num, is_paid: false }, '-created_date'),
      db.RentPayment.filter({ room_number: num, is_paid: false }, '-created_date'),
    ]);
    setUnpaidPower(power);
    setUnpaidWater(water);
    setUnpaidRent(rent);
    setLoading(false);
  };

  const totalUnpaid = unpaidPower.length + unpaidWater.length + unpaidRent.length;
  const totalAmount = [
    ...unpaidPower, ...unpaidWater, ...unpaidRent
  ].reduce((s, r) => s + (r.amount || 0), 0);

  const displayName = room?.room_name || `Δωμάτιο ${num}`;
  const tenantName = room?.first_name ? `${room.first_name} ${room.last_name}` : null;
  const today = format(new Date(), 'd MMMM yyyy', { locale: el });

  const handleShare = async () => {
    // Build share text
    let text = `📋 ΚΑΤΑΣΤΑΣΗ ΟΦΕΙΛΩΝ\n`;
    text += `🏠 ${displayName}`;
    if (tenantName) text += ` — ${tenantName}`;
    text += `\n📅 ${today}\n\n`;

    if (totalUnpaid === 0) {
      text += `✅ Δεν υπάρχουν ανεξόφλητες οφειλές!\n`;
    } else {
      if (unpaidRent.length > 0) {
        text += `🏠 ΕΝΟΙΚΙΟ:\n`;
        unpaidRent.forEach(r => { text += `  • ${r.period}: €${r.amount?.toFixed(2)}\n`; });
      }
      if (unpaidPower.length > 0) {
        text += `\n⚡ ΡΕΥΜΑ:\n`;
        unpaidPower.forEach(r => { text += `  • ${r.period}: ${r.usage} kWh — €${r.amount?.toFixed(2)}\n`; });
      }
      if (unpaidWater.length > 0) {
        text += `\n💧 ΝΕΡΟ:\n`;
        unpaidWater.forEach(r => { text += `  • ${r.period}: ${r.usage} m³ — €${r.amount?.toFixed(2)}\n`; });
      }
      text += `\n💰 ΣΥΝΟΛΟ: €${totalAmount.toFixed(2)}`;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: `Οφειλές ${displayName}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Αντιγράφηκε στο clipboard!');
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-secondary/50 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{displayName}</h1>
          {tenantName && <p className="text-sm text-muted-foreground">{tenantName}</p>}
        </div>
        <Button onClick={handleShare} className="flex items-center gap-2">
          <Share2 className="w-4 h-4" /> Κοινοποίηση
        </Button>
      </div>

      {/* Status card */}
      <div ref={statusRef} className="space-y-4">
        {/* Summary banner */}
        <div className={cn("rounded-2xl p-4 border-2", totalUnpaid === 0
          ? "bg-green-50 dark:bg-green-900/20 border-green-300"
          : "bg-red-50 dark:bg-red-900/20 border-red-300")}>
          <div className="flex items-center gap-3">
            {totalUnpaid === 0
              ? <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
              : <AlertCircle className="w-8 h-8 text-red-600 shrink-0" />
            }
            <div>
              <p className="font-bold text-lg">
                {totalUnpaid === 0 ? 'Όλα τακτοποιημένα!' : `${totalUnpaid} ανεξόφλητες οφειλές`}
              </p>
              {totalUnpaid > 0 && (
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">Σύνολο: €{totalAmount.toFixed(2)}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{today}</p>
            </div>
          </div>
        </div>

        {/* Rent */}
        {unpaidRent.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><Banknote className="w-4 h-4 text-red-500" /> Ενοίκιο</h3>
            {unpaidRent.map(record => (
              <div key={record.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{record.period}</p>
                    {record.partial_notes && <p className="text-xs text-orange-600 mt-1">{record.partial_notes}</p>}
                  </div>
                  <p className="text-xl font-bold text-red-600">€{record.amount?.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Power */}
        {unpaidPower.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Ρεύμα</h3>
            {unpaidPower.map(record => (
              <div key={record.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{record.period}</p>
                    <p className="text-sm text-muted-foreground">{record.usage} kWh</p>
                    <p className="text-xs text-muted-foreground">
                      {record.previous_measure} → {record.new_measure} kWh
                    </p>
                  </div>
                  <p className="text-xl font-bold text-yellow-600">€{record.amount?.toFixed(2)}</p>
                </div>
                {record.photo_url && (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50">
                      <Camera className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Φωτογραφία μετρητή</span>
                    </div>
                    <img src={record.photo_url} alt="Μετρητής" className="w-full max-h-40 object-contain bg-black cursor-pointer"
                      onClick={() => window.open(record.photo_url, '_blank')} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Water */}
        {unpaidWater.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-500" /> Νερό</h3>
            {unpaidWater.map(record => (
              <div key={record.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{record.period}</p>
                    <p className="text-sm text-muted-foreground">{record.usage} m³</p>
                    <p className="text-xs text-muted-foreground">
                      {record.previous_measure} → {record.new_measure} m³
                    </p>
                  </div>
                  <p className="text-xl font-bold text-blue-600">€{record.amount?.toFixed(2)}</p>
                </div>
                {record.photo_url && (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50">
                      <Camera className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Φωτογραφία μετρητή</span>
                    </div>
                    <img src={record.photo_url} alt="Μετρητής" className="w-full max-h-40 object-contain bg-black cursor-pointer"
                      onClick={() => window.open(record.photo_url, '_blank')} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalUnpaid === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500 opacity-50" />
            <p>Δεν υπάρχουν οφειλές για αυτό το δωμάτιο!</p>
          </div>
        )}
      </div>
    </div>
  );
}
