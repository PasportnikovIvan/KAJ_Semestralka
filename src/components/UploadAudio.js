import React, { useState, useEffect, useRef, useContext } from "react";
import { FileContext } from "../contexts/fileContext";
import { FileUploader } from "react-drag-drop-files";

const fileTypes = ["mp3", "mp4", "wav", "3gp", "flac"];

const UploadAudio = ({ history }) => {
	const inputFile = useRef(null);
	const { fileURL, setFileURL } = useContext(FileContext);
	const [file, setFile] = useState(null);

	useEffect(() => {
		if (file) {
			setFileURL(file);
			history.push("/edit");
		}
	}, [file, setFileURL, history]);

	const handleButtonClick = () => {
		inputFile.current.click();
	};

	const handleFileUpload = e => {
		// console.log(file);
		setFile(URL.createObjectURL(e.target.files[0]));
	};
	const handleChange = file => {
		setFile(URL.createObjectURL(file));
	};
	return (
		<div className="upload-audio">
			<i style={{ color: "#531A65" }} className="material-icons audio-icon">
				library_music
			</i>
			<h1>Upload your audio file here</h1>
			<button
				className="upload-btn"
				style={{ marginBottom: "20px" }}
				onClick={handleButtonClick}
			>
				Upload
			</button>
			<input
				type="file"
				id="file"
				ref={inputFile}
				style={{ display: "none" }}
				accept="audio/*"
				onChange={handleFileUpload}
			/>
			<FileUploader
				handleChange={handleChange}
				name="file"
				types={fileTypes}
				classes={"drop-zone"}
			/>
		</div>
	);
};

export default UploadAudio;
