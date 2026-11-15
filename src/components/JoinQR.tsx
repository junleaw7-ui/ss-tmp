'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getBaseUrl } from '@/lib/baseUrl';

export default function JoinQR() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // Computed after mount so server and client markup match on first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(`${getBaseUrl()}/join`);
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <h3 className="text-sm font-semibold text-gray-700">Judges: scan to try</h3>
      <div className="h-[128px] w-[128px]">
        {url && <QRCodeSVG value={url} size={128} />}
      </div>
      {url && (
        <>
          <p className="break-all text-xs text-gray-500">{url}</p>
          <a href={url} className="text-sm underline" style={{ color: '#0F766E' }}>
            Try it as a household
          </a>
        </>
      )}
    </div>
  );
}
