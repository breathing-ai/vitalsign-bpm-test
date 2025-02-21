"use client"
import { useEffect, useRef } from 'react';

interface IceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
}
class RPPGJS {
    private rppgURL: string | null = null;
    private iceServers: IceServer[] | null = null;
    private videoElId: string | null = null;
    private pc: RTCPeerConnection | null = null;
    private dc: RTCDataChannel | null = null;
    private dcInterval: NodeJS.Timeout | null = null;
    private onDataReceived: ((data: any) => void) | null = null;
    private onPcChanged: ((pc: RTCPeerConnection) => void) | null = null;

    initialize(rppgURL: string, videoElId: string, onDataReceived: (data: any) => void, onPcChanged: (pc: RTCPeerConnection) => void, iceServers: IceServer[]) {
        this.rppgURL = rppgURL;
        this.videoElId = videoElId;
        this.onDataReceived = onDataReceived;
        this.onPcChanged = onPcChanged;
        this.iceServers = iceServers;
    }

    createPeerConnection(): RTCPeerConnection {
        const config: RTCConfiguration = {
            iceCandidatePoolSize: 2,
            iceServers: this.iceServers || []
        };

        this.pc = new RTCPeerConnection(config);

        this.pc.addEventListener('icegatheringstatechange', () => {
            if (this.onPcChanged) this.onPcChanged(this.pc!);
        }, false);

        this.pc.addEventListener('iceconnectionstatechange', () => {
            if (this.onPcChanged) this.onPcChanged(this.pc!);
        }, false);

        this.pc.addEventListener('signalingstatechange', () => {
            if (this.onPcChanged) this.onPcChanged(this.pc!);
        }, false);

        this.pc.addEventListener('track', (evt) => {
            if (evt.track.kind === 'video' && this.videoElId) {
                const videoElement = document.getElementById(this.videoElId) as HTMLVideoElement;
                videoElement.srcObject = evt.streams[0];
            }
        });

        return this.pc;
    }

    async getAuthToken(): Promise<string> {
        return process.env.AUTH_TOKEN || '';
    }

    async negotiate(): Promise<void> {
        if (!this.pc) return;

        try {
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            await new Promise<void>((resolve) => {
                if (this.pc!.iceGatheringState === 'complete') {
                    resolve();
                } else {
                    const checkState = () => {
                        if (this.pc!.iceGatheringState === 'complete') {
                            this.pc!.removeEventListener('icegatheringstatechange', checkState);
                            resolve();
                        }
                    };
                    this.pc!.addEventListener('icegatheringstatechange', checkState);
                }
            });

            const offerDescription = this.pc.localDescription;
            if (!offerDescription) return;

            const authToken = await this.getAuthToken();
            const response = await fetch(`${this.rppgURL}/offer`, {
                body: JSON.stringify({
                    sdp: offerDescription.sdp,
                    type: offerDescription.type,
                    video_transform: 'mask'
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                method: 'POST'
            });

            const answer = await response.json();
            await this.pc.setRemoteDescription(answer);
        } catch (e) {
            alert(e);
        }
    }

    startRppgSession() {
        this.pc = this.createPeerConnection();

        this.pc.ondatachannel = (evt) => {
            const channel = evt.channel;
            channel.onmessage = (event) => {
                if (event.data.includes('bpm')) {
                    const messageArea = document.getElementById("bpm");
                    if (messageArea) messageArea.textContent = event.data;
                } else if (event.data.includes('fps')) {
                    const messageArea = document.getElementById("fps");
                    if (messageArea) messageArea.textContent = event.data;
                }
            };
        };

        let time_start: number | null = null;

        const current_stamp = (): number => {
            if (time_start === null) {
                time_start = new Date().getTime();
                return 0;
            } else {
                return new Date().getTime() - time_start;
            }
        };

        const parameters = { ordered: true };

        this.dc = this.pc.createDataChannel('chat', parameters);
        this.dc.onclose = () => {
            console.log('Data channel closed.');
            if (this.dcInterval) clearInterval(this.dcInterval);
        };
        this.dc.onopen = () => {
            console.log('Data channel opened.', this.dc!.id);

            this.dcInterval = setInterval(() => {
                const message = 'ping ' + current_stamp();
                if (this.dc!.readyState === 'open') {
                    this.dc!.send(message);
                }
            }, 500);
        };
        this.dc.onmessage = (event) => {
            if (event.data.includes('bpm')) {
                if (this.onDataReceived) this.onDataReceived(JSON.parse(event.data));
            }
        };

        const constraints: MediaStreamConstraints = { video: true };

        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            stream.getTracks().forEach((track) => {
                this.pc?.addTrack(track, stream);
            });
            return this.negotiate();
        }).catch((err) => {
            alert('Could not acquire media: ' + err);
        });
    }

    stop() {
        console.log('Stopping RPPG connection..');

        if (this.dcInterval) {
            console.log('Cleaning interval..');
            clearInterval(this.dcInterval);
        }
        // close transceivers
        if (this.pc && this.pc.getTransceivers) {
            this.pc.getTransceivers().forEach((transceiver) => {
                if (transceiver.stop) {
                    transceiver.stop();
                }
            });
        }
        // close local audio / video
        if (this.pc) {
            this.pc.getSenders().forEach((sender) => {
                if (sender.track) {
                    sender.track.stop();
                }
            });
        }

        // close data channel
        if (this.dc) {
            this.dc.close();
        }

        setTimeout(() => {
            if (this.pc) {
                this.pc.close();
            }
            this.pc = null;
        }, 500);
    }
}

interface RppgComponentProps {
    iceServers: IceServer[];
    rppgURL: string;
    setRppgData: (data: any) => void;
}

export default function RppgTestComponent({ iceServers, rppgURL, setRppgData }: RppgComponentProps) {
    const rppgRef = useRef<RPPGJS | null>(null);

    useEffect(() => {
        // Initialize only on client side
        if (typeof window !== 'undefined') {
            rppgRef.current = new RPPGJS();

            const handleDataReceived = (data: any) => {
                console.log('Data received:', data);
                if (data) setRppgData(data);
            };

            const handlePcChanged = (pc: RTCPeerConnection) => {
                console.log('PC changed:', pc.iceConnectionState);
            };

            rppgRef.current.initialize(
                rppgURL,
                "rppg-video",
                handleDataReceived,
                handlePcChanged,
                iceServers
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
            <video
                id="rppg-video"
                autoPlay
                playsInline
                className='w-full max-w-[600px] h-[600px]'
            />

        </>
    );
}
