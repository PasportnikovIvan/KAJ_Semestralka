import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import HomePage from "./pages/HomePage";
import EditPage from "./pages/EditPage";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";

const App = () => {
	return (
		<Router>
			<Navbar />
			<Switch>
				<Route path="/" component={HomePage} exact />
				<Route path="/edit" component={EditPage} exact />
			</Switch>
			<Footer />
		</Router>
	);
};

export default App;
