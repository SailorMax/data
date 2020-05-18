(function()
{
	let myScript = document.currentScript;
	let config = {};
	let myPath = null;
	if (myScript && myScript.src)
	{
		let myUrl = new URL(myScript.src);
		myPath = myUrl.protocol + "//" + myUrl.host + myUrl.pathname.replace(/\/init.js$/, "/");

		// arguments:
		// lang=ru
		// countries=auto,RU
		// readonly=1
		// target=css selector without first "#"
		config.lang = myUrl.searchParams.get("lang");
		config.countries = myUrl.searchParams.get("countries");
		config.readonly = myUrl.searchParams.get("readonly");
		config.target = myUrl.searchParams.get("target");
		if (config.target)
			config.target = "#" + config.target;
		else
			config.target = myScript;

		if (config.lang !== "ru")
			config.lang = "en";

		// min size for scroll restore
		if (config.target.tagName != "SCRIPT")
		{
			let user_countries;
			let countries_cnt = 0;
			if (!config.readonly)
			{
				user_countries = localStorage.getItem('countries');
				if (user_countries)
					countries_cnt = JSON.parse(user_countries).length;
			}

			if (!user_countries)
			{
				let countries_cnt = config.countries.length;
				if (config.countries.indexOf("auto") > 0)
					countries_cnt++;
			}

			if (countries_cnt > 0)
			{
				let target_box = document.querySelector(config.target);
				if (target_box && !(window.getComputedStyle(target_box, null).getPropertyValue("min-height")-0))
					target_box.style.minHeight = (270 * countries_cnt)+"px";
			}
		}
	}

	let InitWidget = function()
	{
		// init styles
		let style_link = document.createElement("LINK");
		style_link.rel = "stylesheet";
		style_link.type = "text/css";
		style_link.href = myPath + "lib/styles.css";
		document.head.appendChild( style_link );

/*
		// turn off modules for better compatibility
		import("./lib/widget.js").then(
			function(module)
			{
				var Covid19Widget = module.Covid19Widget;
*/
				// start
				new Covid19Widget(config, myPath);
/*
			}
		).catch(err => console.error(err.message) );
*/
	};

	// by classic method as much faster variant
	// by groups, becasuse some modules can load faster, but we have relation, which can broke functionality
	let modules_list = [
					// main modules
					[
						"d3-selection.v1",
						"d3-dispatch.v1",
						"d3-dsv.v1",
						"d3-format.v1",
						"d3-time-format.v2",
					],
					// with relations
					[
						"d3-fetch.v1",
						"d3-axis.v1",
						"d3-array.v2",
						"d3-interpolate.v1",
						"d3-scale.v3",
						"d3-shape.v1",
						"d3-path.v1",

						"d3-timer.v1",
						"d3-ease.v1",
						"d3-color.v1",
						"d3-transition.v1",

						// my modules
						"./lib/widget.js",
						"./lib/data.js",
						"./lib/single_tooltip.js",
						"./lib/data_tools.js",
						// my data as cache
						"./lib/shared_data.json",
						"./lib/translates/"+config.lang+".json",
					],
					];

	let loaded_counter = 0;
	let module_onload = function(modules_sub_list)
	{
		if (++loaded_counter == modules_sub_list.length)
		{
			if (modules_list.length)
			{
				// next group
				loaded_counter = 0;
				load_modules();
			}
			else
				InitWidget();
		}
	};
	let load_modules = function()
	{
		let modules_sub_list = modules_list.shift();
		let onLoad = () => { module_onload(modules_sub_list) };
		for (let module_name of modules_sub_list)
		{
			if (module_name.substr(-5) == ".json")
			{
				fetch( new Request(myPath + module_name.substr(2)) ).then( onLoad );
			}
			else if (module_name.substr(0, 2) == "./")
			{
//				import(module_name).then(onLoad);
				let script = document.createElement("SCRIPT");
				script.src = myPath + module_name.substr(2);
				script.addEventListener("load", onLoad);
				document.head.appendChild( script );
			}
			else
			{
				let script = document.createElement("SCRIPT");
				script.src = "https://d3js.org/" + module_name + ".js";
				script.addEventListener("load", onLoad);
				document.head.appendChild( script );
			}
		}
	};
	load_modules();
})();
