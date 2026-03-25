import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const DebugModeIndicator = ({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <div className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 my-4">
      <AlertTriangle size={16} />
      <span className="font-bold text-sm">Modo de Teste (Debug) Ativado</span>
    </div>
  );
};
