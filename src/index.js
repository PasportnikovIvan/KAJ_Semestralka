import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { FileContextProvider } from './contexts/fileContext';

ReactDOM.render(
	<React.StrictMode>
		<FileContextProvider>
			<App />
		</FileContextProvider>
	</React.StrictMode>,
	document.getElementById('root')
);

// to log results (reportWebVitals(console.log))
reportWebVitals();
