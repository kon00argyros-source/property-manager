import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { db } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { Card, CardContent, Badge } from '@/components/ui';
import { DoorOpen, Zap, Droplets, Banknote, User, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

const ROOMS = [1,2,3,4,5,6,7,8,9,10,11,12];

const initRooms = async () => {
  const existing = await db.Room.list();
  const existingNums = new Set(existing.map(r => r.room_number));
  for (let i = 1; i <= 12; i++) {
    if (!existingNums.has(i)) await db.Room.create({ room_number: i });
  }
};

export default function Home() {
  const ctx = useOutletContext();
  const refreshKey = ctx?.refreshKey ?? 0;
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

  const getUnpaidCount = (roomNum, type) => {
    if (type === 'power') return data.power.filter(r => r.room_number === roomNum).length;
    if (type === 'water') return data.water.filter(r => r.room_number === roomNum).length;
    if (type === 'rent') return data.rent.filter(r => r.room_number === roomNum).length;
    return 0;
  };

  const getRoomData = (num) => data.rooms.find(r => r.room_number === num);
  const today = new Date();

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Πίνακας Ελέγχου</h1>
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

      {/* Summary cards — fixed for mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
        <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600 shrink-0" />
            <div className="text-center sm:text-left">
              <p className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-400 leading-tight">{data.power.length}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 leading-tight">Ρεύμα</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
            <Droplets className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 shrink-0" />
            <div className="text-center sm:text-left">
              <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400 leading-tight">{data.water.length}</p>
              <p className="text-xs text-blue-600 dark:text-blue-500 leading-tight">Νερό</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3">
            <Banknote className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 shrink-0" />
            <div className="text-center sm:text-left">
              <p className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-400 leading-tight">{data.rent.length}</p>
              <p className="text-xs text-green-600 dark:text-green-500 leading-tight">Ενοίκιο</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rooms grid */}
      <h2 className="text-lg font-semibold mb-4">Επισκόπηση Δωματίων</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROOMS.map((num) => {
          const roomData = getRoomData(num);
          const up = getUnpaidCount(num, 'power');
          const uw = getUnpaidCount(num, 'water');
          const ur = getUnpaidCount(num, 'rent');
          const displayName = roomData?.room_name || `Δωμάτιο ${num}`;
          return (
            <Link key={num} to={`/room/${num}`}>
              <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <DoorOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* Auto-fit text — wraps instead of truncating */}
                      <p className="font-semibold text-sm leading-tight break-words">{displayName}</p>
                      {roomData?.first_name
                        ? <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="break-words">{roomData.first_name} {roomData.last_name}</span>
                          </p>
                        : <p className="text-xs text-muted-foreground italic mt-0.5">Χωρίς ένοικο</p>
                      }
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {up > 0 && <Badge className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5">⚡ {up}</Badge>}
                    {uw > 0 && <Badge className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5">💧 {uw}</Badge>}
                    {ur > 0 && <Badge className="bg-red-100 text-red-700 text-xs px-2 py-0.5">💰 {ur}</Badge>}
                    {up === 0 && uw === 0 && ur === 0 && <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0.5">✓ OK</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
