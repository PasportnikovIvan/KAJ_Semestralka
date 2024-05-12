import React from "react";
import UploadAudio from "../components/UploadAudio";

const HomePage = ({ history }) => {
	return (
		<div className="center-content">
			<UploadAudio history={history} />
		</div>
	);
};

export default HomePage;
