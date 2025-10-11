// "use client"
// import { useEffect, useRef } from 'react';

// interface IceServer {
//     urls: string | string[];
//     username?: string;
//     credential?: string;
// }
// class RPPGJS {
//     private rppgURL: string | null = null;
//     private iceServers: IceServer[] | null = null;
//     private videoElId: string | null = null;
//     private pc: RTCPeerConnection | null = null;
//     private dc: RTCDataChannel | null = null;
//     private dcInterval: NodeJS.Timeout | null = null;
//     private onDataReceived: ((data: any) => void) | null = null;
//     private onPcChanged: ((pc: RTCPeerConnection) => void) | null = null;

//     initialize(rppgURL: string, videoElId: string, onDataReceived: (data: any) => void, onPcChanged: (pc: RTCPeerConnection) => void, iceServers: IceServer[]) {
//         this.rppgURL = rppgURL;
//         this.videoElId = videoElId;
//         this.onDataReceived = onDataReceived;
//         this.onPcChanged = onPcChanged;
//         this.iceServers = iceServers;
//     }

//     createPeerConnection(): RTCPeerConnection {
//         const config: RTCConfiguration = {
//             iceCandidatePoolSize: 2,
//             iceServers: this.iceServers || []
//         };

//         this.pc = new RTCPeerConnection(config);

//         this.pc.addEventListener('icegatheringstatechange', () => {
//             if (this.onPcChanged) this.onPcChanged(this.pc!);
//         }, false);

//         this.pc.addEventListener('iceconnectionstatechange', () => {
//             console.log("ICE connection state changed:", this.pc!.iceConnectionState);
//             if (this.onPcChanged) this.onPcChanged(this.pc!);
//         }, false);

//         this.pc.addEventListener('signalingstatechange', () => {
//             if (this.onPcChanged) this.onPcChanged(this.pc!);
//         }, false);

//         this.pc.addEventListener('track', (evt) => {
//             if (evt.track.kind === 'video' && this.videoElId) {
//                 const videoElement = document.getElementById(this.videoElId) as HTMLVideoElement;
//                 videoElement.srcObject = evt.streams[0];
//             }
//         });

//         return this.pc;
//     }

//     async getAuthToken(): Promise<string> {
//         return process.env.NEXT_PUBLIC_AUTH_TOKEN || '';
//     }

//     async negotiate(): Promise<void> {
//         if (!this.pc) return;

//         try {
//             const offer = await this.pc.createOffer();

//             // Modify SDP to remove RTX format before setting local description
//             let modifiedSdp = offer.sdp;
//             if (modifiedSdp) {
//                 // Remove RTX format lines from SDP
//                 modifiedSdp = modifiedSdp.replace(/a=rtpmap:.*rtx\/.*\r\n/g, '');
//                 modifiedSdp = modifiedSdp.replace(/a=fmtp:.*apt=.*\r\n/g, '');

//                 // Create a new offer with modified SDP
//                 const modifiedOffer = new RTCSessionDescription({
//                     type: 'offer',
//                     sdp: modifiedSdp
//                 });

//                 await this.pc.setLocalDescription(modifiedOffer);
//             } else {
//                 await this.pc.setLocalDescription(offer);
//             }
//             // await this.pc.setLocalDescription(offer);

//             await new Promise<void>((resolve) => {
//                 if (this.pc!.iceGatheringState === 'complete') {
//                     resolve();
//                 } else {
//                     const checkState = () => {
//                         if (this.pc!.iceGatheringState === 'complete') {
//                             this.pc!.removeEventListener('icegatheringstatechange', checkState);
//                             resolve();
//                         }
//                     };
//                     this.pc!.addEventListener('icegatheringstatechange', checkState);
//                 }
//             });

//             const offerDescription = this.pc.localDescription;
//             if (!offerDescription) return;

//             const authToken = await this.getAuthToken();
//             const response = await fetch(`${this.rppgURL}/offer`, {
//                 body: JSON.stringify({
//                     sdp: offerDescription.sdp,
//                     type: offerDescription.type,
//                     video_transform: 'mask'
//                 }),
//                 headers: {
//                     'Content-Type': 'application/json',
//                     'Authorization': `Key ${authToken}`
//                 },
//                 method: 'POST'
//             });

//             const answer = await response.json();
//             await this.pc.setRemoteDescription(answer);
//         } catch (e) {
//             alert(e);
//         }
//     }

//     startRppgSession() {
//         this.pc = this.createPeerConnection();

//         this.pc.ondatachannel = (evt) => {
//             const channel = evt.channel;
//             channel.onmessage = (event) => {
//                 if (event.data.includes('bpm')) {
//                     const messageArea = document.getElementById("bpm");
//                     if (messageArea) messageArea.textContent = event.data;
//                 } else if (event.data.includes('fps')) {
//                     const messageArea = document.getElementById("fps");
//                     if (messageArea) messageArea.textContent = event.data;
//                 }
//             };
//         };

//         let time_start: number | null = null;

//         const current_stamp = (): number => {
//             if (time_start === null) {
//                 time_start = new Date().getTime();
//                 return 0;
//             } else {
//                 return new Date().getTime() - time_start;
//             }
//         };

//         const parameters = { ordered: true };

//         this.dc = this.pc.createDataChannel('chat', parameters);
//         this.dc.onclose = () => {
//             console.log('Data channel closed.');
//             if (this.dcInterval) clearInterval(this.dcInterval);
//         };
//         this.dc.onopen = () => {
//             console.log('Data channel opened.', this.dc!.id);

//             this.dcInterval = setInterval(() => {
//                 const message = 'ping ' + current_stamp();
//                 if (this.dc!.readyState === 'open') {
//                     this.dc!.send(message);
//                 }
//             }, 500);
//         };
//         this.dc.onmessage = (event) => {
//             if (event.data.includes('bpm')) {
//                 if (this.onDataReceived) this.onDataReceived(JSON.parse(event.data));
//             }
//         };

//         const constraints: MediaStreamConstraints = { video: true };

//         navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
//             stream.getTracks().forEach((track) => {
//                 console.log('Adding track:', track , 'to peer connection', this.pc);
//                 this.pc?.addTrack(track, stream);
//             });
//             return this.negotiate();
//         }).catch((err) => {
//             alert('Could not acquire media: ' + err);
//         });
//     }

//     stop() {
//         console.log('Stopping RPPG connection..');

//         if (this.dcInterval) {
//             console.log('Cleaning interval..');
//             clearInterval(this.dcInterval);
//         }
//         // close transceivers
//         if (this.pc && this.pc.getTransceivers) {
//             this.pc.getTransceivers().forEach((transceiver) => {
//                 if (transceiver.stop) {
//                     transceiver.stop();
//                 }
//             });
//         }
//         // close local audio / video
//         if (this.pc) {
//             this.pc.getSenders().forEach((sender) => {
//                 if (sender.track) {
//                     sender.track.stop();
//                 }
//             });
//         }

//         // close data channel
//         if (this.dc) {
//             this.dc.close();
//         }

//         setTimeout(() => {
//             if (this.pc) {
//                 this.pc.close();
//             }
//             this.pc = null;
//         }, 500);
//     }
// }
"use client";

import { useEffect, useRef } from "react";

interface DetectionData {
  bpm?: number | string;
  brightness_level?: string;
  distance_level?: string;
  emotion?: string;
  frame_with_no_face_counter?: number;
  neck_tilt?: string;
  shoulder_tilt?: string;
  hrv_sdnn?: number;
  hrv_rmssd?: number;
  sbp?: string | number;
  dbp?: string | number;
  map_bp?: string | number;
  sleepiness?: number | string;
  tiredness?: number | string;
}

interface MLResponse {
  bpm?: number | string;
  emotion?: string | null;
  shoulder_tilt?: string | null;
  neck_tilt?: string | null;
  timestamp?: number;
  hrv_sdnn?: number;
  hrv_rmssd?: number;
  sleepiness?: number | string;
  tiredness?: number | string;
  sbp?: string | number;
  dbp?: string | number;
  map_bp?: string | number;
  brightness_level?: string;
  distance_level?: string;
  frame_with_no_face_counter?: number;
  alertness_score?: number;
  alertness_status?: string;
}

interface MessageData {
  message: string;
}

export class RPPGJS {
  private rppgURL: string | null = null;
  private videoElId: string | null = null;
  private ws: WebSocket | null = null;
  private localStream: MediaStream | null = null;
  private frameInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private onDataReceived:
    | ((data: DetectionData | MessageData | MLResponse) => void)
    | null = null;
  private onConnectionChanged: ((status: string) => void) | null = null;
  private authToken: string | null = null;
  private targetFps: number = 30;
  private frameCount: number = 0;
  private isConnected: boolean = false;
  private optimizing: boolean = false;
  // Prevent overlapping reconnect attempts
  private isReconnecting: boolean = false;
  // Reconnect control
  private shouldReconnect: boolean = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectDelay: number = 30000; // 30s
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  // Session resume support
  private sessionId: string | null = null;
  // Outgoing frame sequencing and queue (to avoid data loss during reconnect)
  private frameSeq: number = 0;
  private sendQueue: Array<any> = [];
  // Promise for an in-flight connect to serialize multiple callers
  private connectingPromise: Promise<void> | null = null;

  initialize(
    rppgURL: string,
    videoElId: string,
    onDataReceived: (data: DetectionData | MessageData | MLResponse) => void,
    onConnectionChanged: (status: string) => void,
    // authToken?: string,
    optimizing?: boolean
  ) {
    this.rppgURL = rppgURL;
    this.videoElId = videoElId;
    this.onDataReceived = onDataReceived;
    this.onConnectionChanged = onConnectionChanged;
    this.authToken = localStorage.getItem("token") || "";
    this.optimizing = optimizing || false;
    // Ensure we have a stable session id persisted across reloads/ reconnects
    this.sessionId = this.getOrCreateSessionId();
  }

  // Minimal session id helpers (persisted to localStorage)
  private generateSessionId(): string {
    // simple unique-ish id; replace with UUID lib if desired
    return `${Date.now().toString(36)}-${Math.floor(
      Math.random() * 0xfffff
    ).toString(36)}`;
  }

  private getOrCreateSessionId(): string {
    try {
      const KEY = "vitalsign_rppg_session_id";
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = this.generateSessionId();
        localStorage.setItem(KEY, id);
      }
      return id as string;
    } catch (e) {
      // fallback: ephemeral id
      return this.generateSessionId();
    }
  }

  private async connectWebSocket(): Promise<void> {
    // If a connect is already in progress, reuse its promise
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = new Promise((resolve, reject) => {
      if (!this.rppgURL) {
        reject(new Error("RPPG URL not set"));
        this.connectingPromise = null;
        return;
      }

      // Convert HTTP/HTTPS URL to WebSocket URL
      const wsUrl = new URL(this.rppgURL);
      wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
      wsUrl.pathname = "/ws";

      // Add token parameter if provided, otherwise use dev bypass token
      if (this.authToken) {
        wsUrl.searchParams.set("token", this.authToken);
      }
      // if (this.optimizing) {
      //   wsUrl.searchParams.set('optimizing', 'true');
      // }

      console.log("Connecting to WebSocket:", wsUrl.toString());
      // If an existing socket exists, close it first to avoid duplicates
      try {
        if (this.ws) {
          try {
            this.ws.onopen = null as any;
            this.ws.onmessage = null as any;
            this.ws.onclose = null as any;
            this.ws.onerror = null as any;
            // Only close if it's not already CLOSED to avoid extra errors
            if (
              this.ws.readyState === WebSocket.OPEN ||
              this.ws.readyState === WebSocket.CONNECTING ||
              this.ws.readyState === WebSocket.CLOSING
            ) {
              try {
                this.ws.close();
              } catch (e) {
                console.warn("Error closing existing websocket", e);
              }
            }
          } catch (e) {
            console.warn(
              "Error closing previous WebSocket before reconnect",
              e
            );
          }
          this.ws = null;
        }
      } catch (e) {
        // ignore
      }

      try {
        this.ws = new WebSocket(wsUrl.toString());
      } catch (e) {
        console.error("Failed to create WebSocket:", e);
        this.connectingPromise = null;
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        try {
          console.log("WebSocket connected");
          this.isConnected = true;
          this.isReconnecting = false;
          // Reset reconnect attempts on successful connection
          this.reconnectAttempts = 0;
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout as any);
            this.reconnectTimeout = null;
          }
          // Clear connect timeout if present
          if (this.connectTimeout) {
            clearTimeout(this.connectTimeout as any);
            this.connectTimeout = null;
          }
          if (this.onConnectionChanged) {
            this.onConnectionChanged("Connected");
          }
          resolve();
        } finally {
          // clear the in-flight promise after resolution
          this.connectingPromise = null;
        }
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log("WebSocket disconnected:", event.code, event.reason);
        this.isConnected = false;
        this.isReconnecting = false;
        if (this.onConnectionChanged) {
          this.onConnectionChanged("Disconnected");
        }
        // If we should reconnect (i.e. not explicitly stopped), schedule reconnect
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
        // If a connect was in-flight, reject it
        try {
          if (this.connectingPromise) {
            // ensure the in-flight promise is cleared
            this.connectingPromise = null;
            // No direct reject here because we don't have the reject closure; callers will observe onerror/timeout
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (this.onConnectionChanged) {
          this.onConnectionChanged("Error");
        }
        // Clear connect timeout if present
        if (this.connectTimeout) {
          clearTimeout(this.connectTimeout as any);
          this.connectTimeout = null;
        }
        // If this connect is still considered in-flight, reject it
        try {
          reject(error);
        } catch (e) {
          // swallow
        } finally {
          this.connectingPromise = null;
        }

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      // Timeout after 10 seconds
      const currentPromise = this.connectingPromise;
      this.connectTimeout = setTimeout(() => {
        // Only reject if this is still the same in-flight connect
        if (!this.isConnected && this.connectingPromise === currentPromise) {
          this.connectTimeout = null;
          try {
            reject(new Error("WebSocket connection timeout"));
          } catch (e) {
            // ignore
          }
          this.connectingPromise = null;
          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        }
      }, 10000);
    });
    return this.connectingPromise;
  }

  private async handleWebSocketMessage(event: MessageEvent) {
    // Helper to process a string payload safely
    const processText = (text: string) => {
      // Trim small whitespace
      const trimmed = typeof text === "string" ? text.trim() : text;

      // If this looks like a data URI (mask image), render it directly
      if (typeof trimmed === "string" && trimmed.startsWith("data:")) {
        try {
          //   this.displayMaskFrame(trimmed);
          return;
        } catch (e) {
          console.error("Error displaying mask frame from data URI:", e);
        }
      }

      // Try parsing JSON safely
      let message: any = null;
      try {
        message = JSON.parse(trimmed);
      } catch (e) {
        // Not JSON — forward as a plain message string
        if (this.onDataReceived) {
          this.onDataReceived({ message: trimmed });
        }
        return;
      }

      // If parsed to an object, handle known message types
      if (message && typeof message === "object") {
        switch (message.type) {
          case "rppg_data":
            if (this.onDataReceived && message.data) {
              console.log("RPPG Data:", message.data);
              this.onDataReceived(message.data);
            }
            break;
          case "mask":
            if (message.frame) {
              this.displayMaskFrame(message.frame);
            }
            break;
          case "error":
            console.error("Server error:", message.message);
            break;
          default:
            console.log("Unknown message type:", message.type);
        }
      }
    };

    try {
      const data = event.data;

      if (typeof data === "string") {
        processText(data);
        return;
      }

      // Blob (binary) — read as text
      if (typeof Blob !== "undefined" && data instanceof Blob) {
        try {
          const text = await data.text();
          processText(text);
        } catch (e) {
          console.error("Failed to read Blob WebSocket message as text:", e);
        }
        return;
      }

      // ArrayBuffer — decode to string
      if (data instanceof ArrayBuffer) {
        try {
          const decoded = new TextDecoder().decode(new Uint8Array(data));
          processText(decoded);
        } catch (e) {
          console.error("Failed to decode ArrayBuffer WebSocket message:", e);
        }
        return;
      }

      // Fallback: attempt to stringify and process
      try {
        processText(String(data));
      } catch (e) {
        console.error("Unhandled WebSocket message type:", e);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      if (this.onDataReceived) {
        try {
          this.onDataReceived({ message: String(event.data) });
        } catch (e) {
          // swallow
        }
      }
    }
  }

  private async getUserMedia(): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: this.targetFps },
      },
      audio: false,
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  private startFrameCapture() {
    if (!this.videoElId) {
      return;
    }
    const videoElement = document.getElementById(
      this.videoElId
    ) as HTMLVideoElement;
    if (!videoElement) {
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    this.frameInterval = setInterval(() => {
      if (!this.isConnected || !videoElement.videoWidth) {
        return;
      }

      // Set canvas dimensions to video dimensions
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage(videoElement, 0, 0);

      // Convert to base64 JPEG
      const frameData = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];

      // Send frame via WebSocket
      this.sendFrame(frameData);
      this.frameCount++;
    }, 1000 / this.targetFps);
  }

  private sendFrame(frameData: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: "frame",
        frame: `data:image/jpeg;base64,${frameData}`,
      };

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error sending frame:", error);
        // Reconnect if connection is lost
        if (this.ws.readyState !== WebSocket.OPEN) {
          this.isConnected = false;
          if (this.onConnectionChanged) {
            this.onConnectionChanged("Connection lost, reconnecting...");
          }
        }
      }
    }
  }

  private startPingInterval() {
    // Send ping requests to get processed data
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const message = {
          type: "ping",
        };
        this.ws.send(JSON.stringify(message));
      }
    }, 500); // Ping every 500ms to match server expectations
  }

  private displayMaskFrame(frameBase64: string) {
    // Display the processed mask frame as an overlay on top of the video element.
    // The server sends a base64 image (data URI). We draw it onto an overlay canvas
    // which is created next to the video element by ensureOverlayElements.
    try {
      if (!this.videoElId) {
        return;
      }

      const videoElement = document.getElementById(
        this.videoElId
      ) as HTMLVideoElement;
      if (!videoElement) {
        return;
      }

      // Ensure overlay canvas exists and is sized to the video
      const overlayId = `${this.videoElId}-mask-canvas`;
      const overlayImgId = `${this.videoElId}-mask-img`;
      let canvas = document.getElementById(
        overlayId
      ) as HTMLCanvasElement | null;
      if (!canvas) {
        this.ensureOverlayElements(videoElement);
        canvas = document.getElementById(overlayId) as HTMLCanvasElement | null;
      }

      if (!canvas) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      // Resize canvas to match video dimensions if needed
      const width = videoElement.videoWidth || videoElement.clientWidth || 640;
      const height =
        videoElement.videoHeight || videoElement.clientHeight || 480;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Create image and draw when loaded
      const img = new Image();
      img.onload = () => {
        // Clear previous overlay
        ctx.clearRect(0, 0, canvas!.width, canvas!.height);
        // Draw the mask image over the video. The mask image is expected to match
        // the video frame size or will be scaled to fit.
        ctx.drawImage(img, 0, 0, canvas!.width, canvas!.height);
      };
      img.onerror = (e) => {
        console.error("Failed to load mask image for overlay", e);
      };
      img.src = frameBase64;
      // Also set optional debug/fallback image src (kept hidden by default)
      try {
        const overlayImgId = `${this.videoElId}-mask-img`;
        const overlayImg = document.getElementById(
          overlayImgId
        ) as HTMLImageElement | null;
        if (overlayImg) {
          overlayImg.src = frameBase64;
        }
      } catch (e) {
        // Non-fatal
      }
    } catch (error) {
      console.error("Error displaying mask frame:", error);
    }
  }

  // Ensure overlay canvas (and optional image) exist and are positioned over the video
  private ensureOverlayElements(videoElement: HTMLVideoElement) {
    if (!this.videoElId) {
      return;
    }

    const overlayId = `${this.videoElId}-mask-canvas`;
    const overlayImgId = `${this.videoElId}-mask-img`;

    // Make the parent positioned so absolute overlay can sit on top
    const parent = videoElement.parentElement;
    if (parent && getComputedStyle(parent).position === "static") {
      parent.style.position = "relative";
    }

    // Create or update canvas
    let canvas = document.getElementById(overlayId) as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = overlayId;
      // Position overlay exactly on top of video
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "999";

      // Make sure video element is positioned in the stacking context
      if (getComputedStyle(videoElement).position === "static") {
        videoElement.style.position = "relative";
      }

      // Insert canvas as sibling after video so it overlays correctly
      if (parent) {
        parent.insertBefore(canvas, videoElement.nextSibling);
      } else {
        document.body.appendChild(canvas);
      }
    }

    // Create an optional image element for debug/fallback display
    let imgEl = document.getElementById(
      overlayImgId
    ) as HTMLImageElement | null;
    if (!imgEl) {
      imgEl = document.createElement("img");
      imgEl.id = overlayImgId;
      imgEl.style.position = "absolute";
      imgEl.style.left = "0";
      imgEl.style.top = "0";
      imgEl.style.pointerEvents = "none";
      imgEl.style.zIndex = "998";
      imgEl.style.opacity = "0.0"; // default hidden; set to >0 to debug
      if (parent) {
        parent.insertBefore(imgEl, canvas.nextSibling);
      } else {
        document.body.appendChild(imgEl);
      }
    }

    // Size the canvas to the current video size
    const width = videoElement.videoWidth || videoElement.clientWidth || 640;
    const height = videoElement.videoHeight || videoElement.clientHeight || 480;
    canvas.width = width;
    canvas.height = height;

    // Keep canvas pixel-sizing in sync with display size
    canvas.style.width = `${videoElement.clientWidth || width}px`;
    canvas.style.height = `${videoElement.clientHeight || height}px`;
    // Also size image overlay (reuse imgEl variable)
    if (imgEl) {
      imgEl.width = width;
      imgEl.height = height;
      imgEl.style.width = canvas.style.width;
      imgEl.style.height = canvas.style.height;
    }
  }

  async startRppgSession() {
    try {
      if (this.onConnectionChanged) {
        this.onConnectionChanged("Connecting...");
      }

      // allow auto-reconnect if connection drops
      this.shouldReconnect = true;

      // Get user media first
      this.localStream = await this.getUserMedia();

      // Set video element source
      if (this.videoElId) {
        const videoElement = document.getElementById(
          this.videoElId
        ) as HTMLVideoElement;
        if (videoElement) {
          videoElement.srcObject = this.localStream;
        }
      }

      // Connect to WebSocket
      await this.connectWebSocket();

      // Start frame capture and ping intervals
      this.startFrameCapture();
      this.startPingInterval();

      if (this.onConnectionChanged) {
        this.onConnectionChanged("Connected and streaming");
      }
    } catch (error) {
      console.error("Error starting RPPG session:", error);
      if (this.onConnectionChanged) {
        this.onConnectionChanged("Error: " + (error as Error).message);
      }
      throw error;
    }
  }

  stop() {
    console.log("Stopping RPPG WebSocket connection...");

    // disable reconnect attempts
    this.shouldReconnect = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout as any);
      this.reconnectTimeout = null;
    }

    // Clear intervals
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.frameInterval = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close WebSocket
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({ type: "close" }));
          } catch (e) {
            // might be partially closed
          }
        }
        try {
          this.ws.close();
        } catch (e) {
          // ignore
        }
      } finally {
        this.ws = null;
      }
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Clear video element
    if (this.videoElId) {
      const videoElement = document.getElementById(
        this.videoElId
      ) as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = null;
      }
    }

    // Remove overlay canvas if present
    try {
      if (this.videoElId) {
        const overlayId = `${this.videoElId}-mask-canvas`;
        const canvas = document.getElementById(overlayId);
        if (canvas && canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
      }
    } catch (e) {
      console.warn("Error removing overlay canvas during stop()", e);
    }

    this.isConnected = false;
    if (this.onConnectionChanged) {
      this.onConnectionChanged("Stopped");
    }
  }

  captureFrame(): string {
    if (!this.videoElId) return "";

    const video = document.getElementById(this.videoElId) as HTMLVideoElement;
    if (!video) return "";

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  // Additional utility methods
  getStats(): { frameCount: number; isConnected: boolean; targetFps: number } {
    return {
      frameCount: this.frameCount,
      isConnected: this.isConnected,
      targetFps: this.targetFps,
    };
  }

  setTargetFps(fps: number) {
    this.targetFps = fps;
    // Restart frame capture if already running
    if (this.frameInterval) {
      clearInterval(this.frameInterval);
      this.startFrameCapture();
    }
  }

  // Schedule reconnect using exponential backoff
  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    if (this.isReconnecting) {
      console.log("Already reconnecting, skipping schedule");
      return;
    }
    // exponential backoff: min(2^attempt * 1000, maxReconnectDelay)
    const delay = Math.min(
      Math.pow(2, this.reconnectAttempts) * 1000,
      this.maxReconnectDelay
    );
    console.log(
      `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    );
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout as any);
    }
    this.reconnectTimeout = setTimeout(() => this.attemptReconnect(), delay);
    this.isReconnecting = true;
    this.reconnectAttempts++;
  }

  private async attemptReconnect() {
    if (!this.shouldReconnect) {
      this.isReconnecting = false;
      return;
    }
    if (
      this.isReconnecting &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      // Already reconnected by other path
      this.isReconnecting = false;
      return;
    }
    try {
      console.log("Attempting WebSocket reconnect...");
      await this.connectWebSocket();
      this.isReconnecting = false;
      // restart ping and frame capture if not running
      if (!this.frameInterval) {
        this.startFrameCapture();
      }
      if (!this.pingInterval) {
        this.startPingInterval();
      }
    } catch (error) {
      // Clear any pending connect timeout and connecting promise
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout as any);
        this.connectTimeout = null;
      }
      if (this.connectingPromise) {
        // there's no direct way to reject an external Promise here, but clearing
        // the reference prevents later resolves/rejects from being considered current
        this.connectingPromise = null;
      }
      console.warn("Reconnect attempt failed:", error);
      // schedule the next attempt
      this.scheduleReconnect();
    }
  }
}

interface RppgComponentProps {
  iceServers: RTCIceServer[];
  rppgURL: string;
  setRppgData: (data: any) => void;
}

export default function RppgTestComponent({
  iceServers,
  rppgURL,
  setRppgData,
}: RppgComponentProps) {
  const rppgRef = useRef<RPPGJS | null>(null);

  useEffect(() => {
    // Initialize only on client side
    if (typeof window !== "undefined") {
      rppgRef.current = new RPPGJS();

      const handleDataReceived = (data: any) => {
        console.log("Data received:", data);
        if (data) setRppgData(data);
      };

      const handlePcChanged = (status: string) => {
        console.log("PC status changed:", status);
      };

      rppgRef.current.initialize(
        rppgURL,
        "rppg-video",
        handleDataReceived,
        handlePcChanged,
        true
      );

      // Start session
      rppgRef.current.startRppgSession();

      // Cleanup
      return () => {
        if (rppgRef.current) {
          rppgRef.current.stop();
        }
      };
    }
  }, []);

  return (
    <>
      {/* <video
        id="rppg-video"
        autoPlay
        playsInline
        className="w-full max-w-[600px] h-fit"
      /> */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ zIndex: 40 }}
      >
        <video
          id="rppg-video"
          autoPlay
          muted
          playsInline
          className="md:w-full md:min-h-[580px] min-h-[400px] aspect-video"
          style={{ transform: "scaleX(-1)" }} // mirror horizontally
        />
        <canvas
          id="rppg-video-mask-canvas"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
            zIndex: 30,
            width: "100%",
            height: "100%",
            transform: "scaleX(-1)", // mirror canvas too
          }}
        />
        <img
          id="rppg-video-mask-img"
          alt="mask-overlay"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
            zIndex: 29,
            opacity: 0,
            width: "100%",
            height: "100%",
            transform: "scaleX(-1)", // mirror overlay image
          }}
        />
      </div>
    </>
  );
}
