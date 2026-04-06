import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { db } from '@/lib/db';
import { roomNamesCache } from '@/lib/roomNames';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { DoorOpen, User, Zap, Droplets, Banknote, StickyNote, Paperclip } from 'lucide-react';
import { PowerTab, WaterTab, RentTab, NotesTab, RoomInfoTab, FilesTab } from '@/components/room/RoomTabs';

export default function RoomPage() {
  const { roomNumber } = useParams();
  const num = parseInt(roomNumber);
  const ctx = useOutletContext();
  const refreshKey = ctx?.refreshKey ?? 0;
  const [room, setRoom] = useState(null);
  const [localKey, setLocalKey] = useState(0);

  useEffect(() => { loadRoom(); }, [num, refreshKey, localKey]);

  const loadRoom = async () => {
    const rooms = await db.Room.filter({ room_number: num });
    if (rooms.length > 0) setRoom(rooms[0]);
    else { const r = await db.Room.create({ room_number: num }); setRoom(r); }
  };

  const handleUpdate = async () => {
    await roomNamesCache.load();
    setLocalKey(k => k + 1);
  };

  const combinedKey = refreshKey + localKey;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <DoorOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{room?.room_name || `Δωμάτιο ${num}`}</h1>
          {room?.first_name && <p className="text-sm text-muted-foreground">{room.first_name} {room.last_name}</p>}
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="w-full grid grid-cols-6 mb-6">
          <TabsTrigger value="info" className="text-xs sm:text-sm gap-1">
            <User className="w-3.5 h-3.5 hidden sm:block" /> Στοιχεία
          </TabsTrigger>
          <TabsTrigger value="power" className="text-xs sm:text-sm gap-1">
            <Zap className="w-3.5 h-3.5 hidden sm:block" /> Ρεύμα
          </TabsTrigger>
          <TabsTrigger value="water" className="text-xs sm:text-sm gap-1">
            <Droplets className="w-3.5 h-3.5 hidden sm:block" /> Νερό
          </TabsTrigger>
          <TabsTrigger value="rent" className="text-xs sm:text-sm gap-1">
            <Banknote className="w-3.5 h-3.5 hidden sm:block" /> Ενοίκιο
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs sm:text-sm gap-1">
            <StickyNote className="w-3.5 h-3.5 hidden sm:block" /> Σημ/σεις
          </TabsTrigger>
          <TabsTrigger value="files" className="text-xs sm:text-sm gap-1">
            <Paperclip className="w-3.5 h-3.5 hidden sm:block" /> Αρχεία
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info"><RoomInfoTab room={room} onUpdate={handleUpdate} /></TabsContent>
        <TabsContent value="power"><PowerTab roomNumber={num} refreshKey={combinedKey} /></TabsContent>
        <TabsContent value="water"><WaterTab roomNumber={num} refreshKey={combinedKey} /></TabsContent>
        <TabsContent value="rent"><RentTab roomNumber={num} refreshKey={combinedKey} /></TabsContent>
        <TabsContent value="notes"><NotesTab roomNumber={num} refreshKey={combinedKey} /></TabsContent>
        <TabsContent value="files"><FilesTab roomNumber={num} refreshKey={combinedKey} /></TabsContent>
      </Tabs>
    </div>
  );
}
