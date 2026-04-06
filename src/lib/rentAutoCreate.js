import { db } from './db';

export const autoCreateMonthlyRent = async () => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentPeriod = `${currentMonth}/${currentYear}`;

    // Use localStorage to avoid running multiple times per month
    const lastRun = localStorage.getItem('rent_auto_period');
    if (lastRun === currentPeriod) {
      console.log('Rent already created for', currentPeriod);
      return;
    }

    console.log('Checking rent for period:', currentPeriod);

    const rooms = await db.Room.list();
    if (!rooms || rooms.length === 0) return;

    // Get ALL rent payments for this period
    const existingRent = await db.RentPayment.filter({ period: currentPeriod });
    const roomsWithRent = new Set(existingRent.map(r => r.room_number));

    let created = 0;
    for (const room of rooms) {
      if (!room.rent_amount || room.rent_amount <= 0) continue;
      if (roomsWithRent.has(room.room_number)) continue;

      await db.RentPayment.create({
        room_number: room.room_number,
        period: currentPeriod,
        amount: room.rent_amount,
        is_paid: false,
      });
      created++;
      console.log(`Created rent for room ${room.room_number}: €${room.rent_amount}`);
    }

    console.log(`Auto-rent: created ${created} entries for ${currentPeriod}`);

    // Save that we ran for this period
    localStorage.setItem('rent_auto_period', currentPeriod);

  } catch (err) {
    console.error('Auto rent creation failed:', err);
  }
};

// Call this to force re-run (e.g. after adding a new room)
export const resetRentAutoCreate = () => {
  localStorage.removeItem('rent_auto_period');
};
