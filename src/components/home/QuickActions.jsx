import React, { useState } from 'react';
import FAB from './FAB';
import AddUtilityDialog from './AddUtilityDialog';
import PaymentDialog from './PaymentDialog';
import AddNoteDialog from './AddNoteDialog';

export default function QuickActions({ onSaved }) {
  const [utilityType, setUtilityType] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showNote, setShowNote] = useState(false);

  const handleFABAction = (id) => {
    if (id === 'power' || id === 'water') setUtilityType(id);
    else if (id === 'payment') setShowPayment(true);
    else if (id === 'note') setShowNote(true);
  };

  return (
    <>
      <FAB onAction={handleFABAction} />
      <AddUtilityDialog open={utilityType !== null} onClose={() => setUtilityType(null)} type={utilityType || 'power'} onSaved={onSaved} />
      <PaymentDialog open={showPayment} onClose={() => setShowPayment(false)} onSaved={onSaved} />
      <AddNoteDialog open={showNote} onClose={() => setShowNote(false)} onSaved={onSaved} />
    </>
  );
}
