import React, { useState, useEffect, useContext, useRef } from "react";
import TimelinePlugin from "wavesurfer.js/dist/plugin/wavesurfer.timeline.min.js";
import RegionsPlugin from "wavesurfer.js/dist/plugin/wavesurfer.regions.min.js";
import { FileContext } from "../contexts/fileContext";
import wavesurfer from "wavesurfer.js";
import * as lamejs from "@breezystack/lamejs";

function analyzeAudioBuffer(aBuffer) {
	let numOfChan = aBuffer.numberOfChannels,
		btwLength = aBuffer.length * numOfChan * 2 + 44,
		btwArrBuff = new ArrayBuffer(btwLength),
		btwView = new DataView(btwArrBuff),
		btwChnls = [],
		btwIndex,
		btwSample,
		btwOffset = 0,
		btwPos = 0;
	setUint32(0x46464952); // "RIFF"
	setUint32(btwLength - 8); // file length - 8
	setUint32(0x45564157); // "WAVE"
	setUint32(0x20746d66); // "fmt " chunk
	setUint32(16); // length = 16
	setUint16(1); // PCM (uncompressed)
	setUint16(numOfChan);
	setUint32(aBuffer.sampleRate);
	setUint32(aBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
	setUint16(numOfChan * 2); // block-align
	setUint16(16); // 16-bit
	setUint32(0x61746164); // "data" - chunk
	setUint32(btwLength - btwPos - 4); // chunk length

	for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++)
		btwChnls.push(aBuffer.getChannelData(btwIndex));

	while (btwPos < btwLength) {
		for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
			// interleave btwChnls
			btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset])); // clamp
			btwSample =
				(0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0; // scale to 16-bit signed int
			btwView.setInt16(btwPos, btwSample, true); // write 16-bit sample
			btwPos += 2;
		}
		btwOffset++; // next source sample
	}

	let wavHdr = lamejs.WavHeader.readHeader(new DataView(btwArrBuff));

	//Stereo
	let data = new Int16Array(btwArrBuff, wavHdr.dataOffset, wavHdr.dataLen / 2);
	let leftData = [];
	let rightData = [];
	for (let i = 0; i < data.length; i += 2) {
		leftData.push(data[i]);
		rightData.push(data[i + 1]);
	}
	var left = new Int16Array(leftData);
	var right = new Int16Array(rightData);

	//STEREO
	if (wavHdr.channels === 2)
		return bufferToMp3(wavHdr.channels, wavHdr.sampleRate, left, right);
	//MONO
	else if (wavHdr.channels === 1)
		return bufferToMp3(wavHdr.channels, wavHdr.sampleRate, data);

	function setUint16(data) {
		btwView.setUint16(btwPos, data, true);
		btwPos += 2;
	}

	function setUint32(data) {
		btwView.setUint32(btwPos, data, true);
		btwPos += 4;
	}
}

function bufferToMp3(channels, sampleRate, left, right = null) {
	var buffer = [];
	var mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 128);
	var remaining = left.length;
	var samplesPerFrame = 1152;

	for (var i = 0; remaining >= samplesPerFrame; i += samplesPerFrame) {
		if (!right) {
			var mono = left.subarray(i, i + samplesPerFrame);
			var mp3buf = mp3enc.encodeBuffer(mono);
		} else {
			var leftChunk = left.subarray(i, i + samplesPerFrame);
			var rightChunk = right.subarray(i, i + samplesPerFrame);
			var mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
		}
		if (mp3buf.length > 0) {
			buffer.push(mp3buf); //new Int8Array(mp3buf));
		}
		remaining -= samplesPerFrame;
	}
	var d = mp3enc.flush();
	if (d.length > 0) {
		buffer.push(new Int8Array(d));
	}

	var mp3Blob = new Blob(buffer, { type: "audio/mpeg" });
	//var bUrl = window.URL.createObjectURL(mp3Blob);

	// send the download link to the console
	//console.log('mp3 download:', bUrl);
	return mp3Blob;
}

const AudioWaveform = () => {
	const wavesurferRef = useRef(null);
	const timelineRef = useRef(null);

	// fetch file url from the context
	const { fileURL, setFileURL } = useContext(FileContext);

	// crate an instance of the wavesurfer
	const [wavesurferObj, setWavesurferObj] = useState();

	const [playing, setPlaying] = useState(false); // to keep track whether audio is currently playing or not
	const [volume, setVolume] = useState(1); // to control volume level of the audio. 0-mute, 1-max
	const [zoom, setZoom] = useState(1); // to control the zoom level of the waveform
	const [duration, setDuration] = useState(0); // duration is used to set the default region of selection for trimming the audio

	// create the waveform inside the correct component
	useEffect(() => {
		if (wavesurferRef.current && !wavesurferObj) {
			setWavesurferObj(
				wavesurfer.create({
					container: "#waveform",
					scrollParent: true,
					autoCenter: true,
					cursorColor: "violet",
					loopSelection: true,
					waveColor: "#49216F",
					progressColor: "#69207F",
					responsive: true,
					plugins: [
						TimelinePlugin.create({
							container: "#wave-timeline"
						}),
						RegionsPlugin.create({})
					]
				})
			);
		}
	}, [wavesurferRef, wavesurferObj]);

	// once the file URL is ready, load the file to produce the waveform
	useEffect(() => {
		if (fileURL && wavesurferObj) {
			wavesurferObj.load(fileURL);
		}
	}, [fileURL, wavesurferObj]);

	useEffect(() => {
		if (wavesurferObj) {
			// once the waveform is ready, play the audio
			wavesurferObj.on("ready", () => {
				// wavesurferObj.play();
				wavesurferObj.enableDragSelection({}); // to select the region to be trimmed
				setDuration(Math.floor(wavesurferObj.getDuration())); // set the duration in local state
			});

			// once audio starts playing, set the state variable to true
			wavesurferObj.on("play", () => {
				setPlaying(true);
			});

			// once audio starts playing, set the state variable to false
			wavesurferObj.on("finish", () => {
				setPlaying(false);
			});

			wavesurferObj.on("points-change", points => {
				console.log("Envelope points changed", points);
			});

			// if multiple regions are created, then remove all the previous regions so that only 1 is present at any given time
			wavesurferObj.on("region-updated", region => {
				const regions = region.wavesurfer.regions.list;
				const keys = Object.keys(regions);
				if (keys.length > 1) {
					regions[keys[0]].remove();
				}
			});
		}
	}, [wavesurferObj]);

	// set volume of the wavesurfer object, whenever volume variable in state is changed
	useEffect(() => {
		if (wavesurferObj) wavesurferObj.setVolume(volume);
	}, [volume, wavesurferObj]);

	// set zoom level of the wavesurfer object, whenever the zoom variable in state is changed
	useEffect(() => {
		if (wavesurferObj) wavesurferObj.zoom(zoom);
	}, [zoom, wavesurferObj]);

	// when the duration of the audio is available, set the length of the region depending on it, so as to not exceed the total lenght of the audio
	useEffect(() => {
		if (duration && wavesurferObj) {
			// add a region with default length
			wavesurferObj.addRegion({
				start: Math.floor(duration / 2) - Math.floor(duration) / 5, // time in seconds
				end: Math.floor(duration / 2), // time in seconds
				color: "hsla(265, 100%, 86%, 0.4)" // color of the selected region, light hue of purple
			});
		}
	}, [duration, wavesurferObj]);

	const handlePlayPause = e => {
		wavesurferObj.playPause();
		setPlaying(!playing);
	};

	const handleReload = e => {
		// stop will return the audio to 0s, then play it again
		wavesurferObj.stop();
		wavesurferObj.play();
		setPlaying(true); // to toggle the play/pause button icon
	};

	const handleVolumeSlider = e => {
		setVolume(e.target.value);
	};

	const handleZoomSlider = e => {
		setZoom(e.target.value);
	};

	const handleTrim = e => {
		if (wavesurferObj) {
			// get start and end points of the selected region
			const region =
				wavesurferObj.regions.list[Object.keys(wavesurferObj.regions.list)[0]];

			if (region) {
				const start = region.start;
				const end = region.end;

				// obtain the original array of the audio
				const original_buffer = wavesurferObj.backend.buffer;

				// create a temporary new buffer array with the same length, sample rate and no of channels as the original audio
				const new_buffer = wavesurferObj.backend.ac.createBuffer(
					original_buffer.numberOfChannels,
					original_buffer.length,
					original_buffer.sampleRate
				);

				// create 2 indices:
				// left & right to the part to be trimmed
				const first_list_index = start * original_buffer.sampleRate;
				const second_list_index = end * original_buffer.sampleRate;
				const second_list_mem_alloc =
					original_buffer.length - end * original_buffer.sampleRate;

				// create a new array upto the region to be trimmed
				const new_list = new Float32Array(parseInt(first_list_index));

				// create a new array of region after the trimmed region
				const second_list = new Float32Array(parseInt(second_list_mem_alloc));

				// create an array to combine the 2 parts
				const combined = new Float32Array(original_buffer.length);

				// 2 channels: 1-right, 0-left
				// copy the buffer values for the 2 regions from the original buffer

				// for the region to the left of the trimmed section
				original_buffer.copyFromChannel(new_list, 1);
				original_buffer.copyFromChannel(new_list, 0);

				// for the region to the right of the trimmed section
				original_buffer.copyFromChannel(second_list, 1, second_list_index);
				original_buffer.copyFromChannel(second_list, 0, second_list_index);

				// create the combined buffer for the trimmed audio
				combined.set(new_list);
				combined.set(second_list, first_list_index);

				// copy the combined array to the new_buffer
				new_buffer.copyToChannel(combined, 1);
				new_buffer.copyToChannel(combined, 0);

				const leftChannelData = new_buffer.getChannelData(0); // Left channel
				const rightChannelData = new_buffer.getChannelData(1); // Right channel

				// Step 2: Define a threshold below which audio samples are considered silence
				const threshold = 0.1; // Adjust as needed, this is just an example

				// Step 3: Find the start and end points of the audio data where it exceeds the threshold
				let startSample = 0;
				let endSample = new_buffer.length - 1;

				// Find the start point
				for (let i = 0; i < new_buffer.length; i++) {
					if (
						Math.abs(leftChannelData[i]) > threshold ||
						Math.abs(rightChannelData[i]) > threshold
					) {
						startSample = i;
						break;
					}
				}

				// Find the end point
				for (let i = new_buffer.length - 1; i >= 0; i--) {
					if (
						Math.abs(leftChannelData[i]) > threshold ||
						Math.abs(rightChannelData[i]) > threshold
					) {
						endSample = i;
						break;
					}
				}

				// Step 4: Calculate the duration of the non-silent audio
				const nonSilentDuration =
					(endSample - startSample + 1) / new_buffer.sampleRate;

				// Step 5: Create a new AudioBuffer with trimmed silence
				const audioContext = new AudioContext(); // Assuming you have an AudioContext available
				const trimmedBuffer = audioContext.createBuffer(
					new_buffer.numberOfChannels,
					endSample - startSample + 1,
					new_buffer.sampleRate
				);

				// Copy non-silent audio data to the new buffer
				for (
					let channel = 0;
					channel < new_buffer.numberOfChannels;
					channel++
				) {
					const channelData = new_buffer.getChannelData(channel);
					const trimmedChannelData = trimmedBuffer.getChannelData(channel);
					for (let i = startSample; i <= endSample; i++) {
						trimmedChannelData[i - startSample] = channelData[i];
					}
				}

				// load the new_buffer, to restart the wavesurfer's waveform display
				wavesurferObj.loadDecodedBuffer(trimmedBuffer);
				const regions = wavesurferObj.regions.list;
				const keys = Object.keys(regions);
				regions[keys[0]].remove();
				wavesurferObj.regions.list = regions;
				setDuration(Math.floor(wavesurferObj.getDuration()));
			}
		}
	};

	// useEffect(() => {
	// 	if (!!wavesurferObj) {
	// 		if (!!wavesurferObj.backend) {
	// 			// console.log(wavesurferObj.backend);

	// 			// const buffer = wavesurferObj.backend.buffer;
	// 			// const MP3Blob = analyzeAudioBuffer(buffer);
	// 			// const link = URL.createObjectURL(MP3Blob);
	// 			// console.log(link);
	// 		}
	// 	}
	// }, [wavesurferObj]);

	const downloadHandler = () => {
		if (!!wavesurferObj) {
			console.log(wavesurferObj);
			if (!!wavesurferObj.backend) {
				console.log(wavesurferObj.backend);
				const buffer = wavesurferObj.backend.buffer;
				const MP3Blob = analyzeAudioBuffer(buffer);
				const link = URL.createObjectURL(MP3Blob);
				var a = document.createElement("a");
				document.body.appendChild(a);
				a.style = "display: none";
				a.href = link;
				a.download = "Edited.mp3";
				a.click();
				URL.revokeObjectURL(link);
				console.log(link);
			}
		}
	};

	return (
		<section className="waveform-container">
			<div ref={wavesurferRef} id="waveform" />
			<div ref={timelineRef} id="wave-timeline" />
			<div className="all-controls">
				<div className="left-container">
					<button class="btn" onClick={downloadHandler}>
						<i class="fa fa-download"></i> Download
					</button>
					<button
						title="play/pause"
						className="controls"
						onClick={handlePlayPause}
					>
						{playing ? (
							<i className="material-icons">pause</i>
						) : (
							<i className="material-icons">play_arrow</i>
						)}
					</button>
					<button title="reload" className="controls" onClick={handleReload}>
						<i className="material-icons">replay</i>
					</button>
					<button className="trim" onClick={handleTrim}>
						<i
							style={{
								fontSize: "1.2em",
								color: "white"
							}}
							className="material-icons"
						>
							content_cut
						</i>
						Trim
					</button>
				</div>
				<div className="right-container">
					<div className="volume-slide-container">
						<i className="material-icons zoom-icon">remove_circle</i>
						<input
							type="range"
							min="1"
							max="1000"
							value={zoom}
							onChange={handleZoomSlider}
							class="slider zoom-slider"
						/>
						<i className="material-icons zoom-icon">add_circle</i>
					</div>
					<div className="volume-slide-container">
						{volume > 0 ? (
							<i className="material-icons">volume_up</i>
						) : (
							<i className="material-icons">volume_off</i>
						)}
						<input
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={volume}
							onChange={handleVolumeSlider}
							className="slider volume-slider"
						/>
					</div>
				</div>
			</div>
		</section>
	);
};

export default AudioWaveform;
