import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { Settings as SettingsIcon, Zap, Droplets, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const [form, setForm] = useState({ power_price: 0, water_price: 0 });
  const [saving, setSaving] = useState(false);
  useEffect(() => { db.AppSettings.list().then(s => { if (s.length > 0) setForm({ power_price: s[0].power_price || 0, water_price: s[0].water_price || 0 }); }); }, []);
  const handleSave = async () => {
    setSaving(true);
    const settings = await db.AppSettings.list();
    if (settings.length > 0) await db.AppSettings.update(settings[0].id, form);
    else await db.AppSettings.create(form);
    toast.success('Οι ρυθμίσεις αποθηκεύτηκαν');
    setSaving(false);
  };
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><SettingsIcon className="w-6 h-6 text-primary" /></div>
        <h1 className="text-2xl font-bold text-foreground">Ρυθμίσεις</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Τιμές Κοινοχρήστων</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Τιμή Ρεύματος (€ ανά kWh)</Label>
            <Input type="number" step="0.01" value={form.power_price} onChange={e => setForm({ ...form, power_price: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-500" /> Τιμή Νερού (€ ανά m³)</Label>
            <Input type="number" step="0.01" value={form.water_price} onChange={e => setForm({ ...form, water_price: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="w-4 h-4 mr-2" />{saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
