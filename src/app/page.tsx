"use client";
import React, { useState } from "react";
import RppgTestComponent from "@/components/rppg";

const Page = () => {
  const [rppgdata, setRppgData] = useState<{
    bpm: number | null;
    emotion: string | null;
    shoulder_tilt: number | null;
    neck_tilt: number | null;
  } | null>(null);

  return (
    <div className="flex flex-col w-full h-screen bg-gray-100 items-center justify-center p-4 space-y-6">
      <div className="w-full max-w-[600px] h-fit bg-black rounded-xl overflow-hidden">
        <RppgTestComponent
          rppgURL={process.env.NEXT_PUBLIC_RPPG_URL || "localhost:8080"}
          iceServers={[
            {
              urls: ["stun:stun.l.google.com:19302"],
            },
            {
              urls: "turn:18.234.73.186:3478?transport=tcp",
              credential: "koxmCz4dsVS82Im",
              username: "baiturnuser",
            },
          ]}
          setRppgData={setRppgData}
        />
      </div>
      <div
        className="w-full max-w-[350px] p-6 bg-white rounded-2xl 
    shadow-[inset_5px_5px_10px_rgba(0,0,0,0.1),inset_-5px_-5px_15px_rgba(255,255,255,0.1)] 
    flex flex-col gap-4 text-left text-black/60 text-sm md:text-md lg:text-lg"
      >
        <div className=" font-bold ">
          BPM:{" "}
          <span className="font-normal text-gray-400">
            {rppgdata?.bpm ?? "No data"}
          </span>
        </div>

        <div className=" font-bold ">
          Emotion:{" "}
          <span className="font-normal text-gray-400">
            {rppgdata?.emotion ?? "No data"}
          </span>
        </div>

        <div className=" font-bold ">
          Shoulder Tilt:{" "}
          <span className="font-normal text-gray-400">
            {rppgdata?.shoulder_tilt ?? "No data"}
          </span>
        </div>

        <div className=" font-bold ">
          Neck Tilt:{" "}
          <span className="font-normal text-gray-400">
            {rppgdata?.neck_tilt ?? "No data"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Page;
