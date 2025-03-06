"use client"
import React, { useState } from 'react'
import RppgTestComponent from '@/components/rppg';

const Page = () => {
  const [rppgdata, setRppgData] = useState<{
    bpm: number | null;
    emotion: string | null;
    shoulder_tilt: number | null;
    neck_tilt: number | null;
  } | null>(null);

  return (
    <div className='flex flex-col w-full h-screen bg-gray-50 items-center justify-center p-4'>
      <div className='w-full max-w-[600px] h-[600px]'>
        <RppgTestComponent
          rppgURL={process.env.NEXT_PUBLIC_RPPG_URL || "localhost:8080"}
          iceServers={[
            {
              "urls": ["stun:stun.l.google.com:19302"]
            },
            {
              "urls": "turn:18.234.73.186:3478?transport=tcp",
              "credential": "koxmCz4dsVS82Im",
              "username": "baiturnuser"
            }
          ]}
          setRppgData={setRppgData}
        />
      </div>
      <div className='w-full flex flex-col items-center text-center font-bold'>
        <div className='w-full'>
          BPM <span className='font-normal'>{rppgdata ? rppgdata.bpm : "No data"}</span>
        </div>
        <div className='w-full'>
          Emotion <span className='font-normal'>{rppgdata ? rppgdata.emotion : "No data"}</span>
        </div>
        <div className='w-full'>
          Shoulder Tilt <span className='font-normal'>{rppgdata ? rppgdata.shoulder_tilt : "No data"}</span>
        </div>
        <div className='w-full'>
          Neck Tilt <span className='font-normal'>{rppgdata ? rppgdata.neck_tilt : "No data"}</span>
        </div>
      </div>
    </div>
  )
}

export default Page;