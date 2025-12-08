import React from 'react';

interface Props {
  onReconnect: () => void;
}

export const ConnectionNotice: React.FC<Props> = ({ onReconnect }) => (
  <div className="flex items-center space-x-2">
    <div className="text-yellow-500">WebSocket disconnected</div>
    <button
      onClick={onReconnect}
      className="px-2 py-1 bg-blue-500 text-white rounded text-sm"
    >
      Reconnect
    </button>
  </div>
);