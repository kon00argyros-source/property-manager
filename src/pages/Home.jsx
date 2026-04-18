import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { Card, CardContent, Badge } from '@/components/ui';
import { DoorOpen, Zap, Droplets, Banknote, User, CalendarDays, ChevronDown, ChevronUp, CreditCard, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ROOMS = [1,2,3,4,5,6,7,8,9,10,11,12];

const initRooms = async () => {
  const existing = await db.Room.list();
  const existingNums = new Set(existing.map(r => r.room_number));
  for (let i = 1; i <= 12; i++) {
    if (!existingNums.has(i)) await db.Room.create({ room_number: i });
  }
};

function RoomCard({ num, roomData, unpaidPower, unpaidWater, unpaidRent, onPayClick }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const displayName = roomData?.room_name || `Δωμάτιο ${num}`;
  const totalUnpaid = unpaidPower.length + unpaidWater.length + unpaidRent.length;

  return (
    <Card className={cn("transition-all", expanded && "shadow-lg ring-1 ring-border")}>
      <CardContent className="p-4 sm:p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <DoorOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight break-words">{displayName}</p>
            {roomData?.first_name
              ? <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3 shrink-0" />
                  <span className="break-words">{roomData.first_name} {roomData.last_name}</span>
                </p>
              : <p className="text-xs text-muted-foreground italic mt-0.5">Χωρίς ένοικο</p>
            }
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex gap-1 flex-wrap justify-end">
              {unpaidPower.length > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5">⚡{unpaidPower.length}</Badge>}
              {unpaidWater.length > 0 && <Badge className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5">💧{unpaidWater.length}</Badge>}
              {unpaidRent.length > 0 && <Badge className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5">💰{unpaidRent.length}</Badge>}
              {totalUnpaid === 0 && <Badge className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5">✓</Badge>}
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </CardContent>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 space-y-2 pt-3">
          {totalUnpaid === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Δεν υπάρχουν ανεξόφλητες οφειλές 🎉</p>
          )}
          {unpaidRent.map(record => (
            <div key={record.id} className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">🏠</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300 truncate">Ενοίκιο — {record.period}</p>
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">€{record.amount?.toFixed(2)}</p>
                </div>
              </div>
              <button onClick={() => onPayClick({ room: num, type: 'rent', record })}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-all">
                <CreditCard className="w-3 h-3" /> Πληρωμή
              </button>
            </div>
          ))}
          {unpaidPower.map(record => (
            <div key={record.id} className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-3 py-2.5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">⚡</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 truncate">Ρεύμα — {record.period}</p>
                  <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">€{record.amount?.toFixed(2)}</p>
                </div>
              </div>
              <button onClick={() => onPayClick({ room: num, type: 'power', record })}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-all">
                <CreditCard className="w-3 h-3" /> Πληρωμή
              </button>
            </div>
          ))}
          {unpaidWater.map(record => (
            <div key={record.id} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-xl px-3 py-2.5 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">💧</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-blue-800 dark:text-blue-300 truncate">Νερό — {record.period}</p>
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400">€{record.amount?.toFixed(2)}</p>
                </div>
              </div>
              <button onClick={() => onPayClick({ room: num, type: 'water', record })}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-all">
                <CreditCard className="w-3 h-3" /> Πληρωμή
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => navigate(`/room/${num}`)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-secondary/50 transition-all">
              <DoorOpen className="w-3.5 h-3.5" /> Στοιχεία
            </button>
            <button onClick={() => navigate(`/room/${num}/status`)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-primary/30 text-primary rounded-xl text-xs font-medium hover:bg-primary/10 transition-all">
              <FileText className="w-3.5 h-3.5" /> Κατάσταση
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Home() {
  const ctx = useOutletContext();
  const refreshKey = ctx?.refreshKey ?? 0;
  const navigate = useNavigate();
  const [data, setData] = useState({ rooms: [], power: [], water: [], rent: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [refreshKey]);

  const loadData = async () => {
    setLoading(true);
    await initRooms();
    const rooms = await db.Room.list('room_number');
    await roomNamesCache.load();
    const [power, water, rent] = await Promise.all([
      db.PowerRecord.filter({ is_paid: false }),
      db.WaterRecord.filter({ is_paid: false }),
      db.RentPayment.filter({ is_paid: false }),
    ]);
    setData({ rooms, power, water, rent });
    setLoading(false);
  };

  const handlePayClick = ({ room, type, record }) => {
    navigate(`/room/${room}`, { state: { openPay: true, payType: type, payRecord: record } });
  };

  const today = new Date();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-24">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Πίνακας Ελέγχου</h1>
          <p className="text-muted-foreground mt-1 text-sm">Διαχείριση 12 διαμερισμάτων</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 shadow-sm shrink-0">
          <CalendarDays className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs sm:text-sm font-semibold leading-tight">{format(today, 'EEEE', { locale: el })}</p>
            <p className="text-xs text-muted-foreground leading-tight">{format(today, 'd MMM yyyy', { locale: el })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
        {[
          { color: 'yellow', icon: Zap, count: data.power.length, label: 'Ρεύμα' },
          { color: 'blue', icon: Droplets, count: data.water.length, label: 'Νερό' },
          { color: 'green', icon: Banknote, count: data.rent.length, label: 'Ενοίκιο' },
        ].map(({ color, icon: Icon, count, label }) => (
          <Card key={label} className={`bg-${color}-50 dark:bg-${color}-900/20 border-${color}-200`}>
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-1 sm:gap-3">
              <Icon className={`w-6 h-6 sm:w-8 sm:h-8 text-${color}-600 shrink-0`} />
              <div className="text-center sm:text-left">
                <p className={`text-xl sm:text-2xl font-bold text-${color}-700 dark:text-${color}-400 leading-tight`}>{count}</p>
                <p className={`text-xs text-${color}-600 dark:text-${color}-500 leading-tight`}>{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-4">Επισκόπηση Δωματίων</h2>
      <div className="space-y-3">
        {ROOMS.map(num => (
          <RoomCard key={num} num={num}
            roomData={data.rooms.find(r => r.room_number === num)}
            unpaidPower={data.power.filter(r => r.room_number === num)}
            unpaidWater={data.water.filter(r => r.room_number === num)}
            unpaidRent={data.rent.filter(r => r.room_number === num)}
            onPayClick={handlePayClick}
          />
        ))}
      </div>
    </div>
  );
}
