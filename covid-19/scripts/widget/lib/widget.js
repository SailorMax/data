/*
import Covid19Data from "./data.js";
import Covid19SingleTooltip from "./single_tooltip.js";
import Covid19DataTools from "./data_tools.js";
import { Cv19SMW_COUNTRY_GROUPS } from "./shared_data.js";

export
*/
class Covid19Widget
{
	constructor(config, myPath)
	{
		this.COUNTRY_BORDERS = {};	// fills later
		this.WORDS = {};
		this.COUNTRY_GROUPS = {};
		this.PREFACE_LIST = {};
		this.FOOTNOTES_LIST = {};

		var self = this;
		d3.json(myPath+"lib/shared_data.json", {cache:"force-cache"}).then(function(data)
		{
			self.COUNTRY_GROUPS = data.COUNTRY_GROUPS;
		});
		d3.json(myPath+"lib/translates/"+config.lang+".json", {cache:"force-cache"}).then(function(data)
		{
			self.WORDS = data.WORDS;
			self.PREFACE_LIST = data.PREFACE_LIST;
			self.FOOTNOTES_LIST = data.FOOTNOTES_LIST;
		});

		this.config = config;

		this.ms_in_day = 24*60*60*1000;
		this.ms_in_month = 31*this.ms_in_day;

		// incubation period = 5.1 days
		// first symptoms in 11.5 days => use 12 days as week
		// https://ria.ru/20200322/1568965195.html
		this.calc_days = 12;
		this.calc_days_ms = this.calc_days * this.ms_in_day;

		this.default_countries = [];
		if (this.config && this.config.countries)
			this.default_countries = this.config.countries.split(",").filter(v=>v);

		this.width = 520;
		this.height = 200;
		this.margin = ({top: 20, right: 40, bottom: 20, left: 40});
		this.bar_space = 30;

		var now = new Date();
		this.bars_count = Math.floor( (this.width - this.margin.left - this.margin.right) / this.bar_space ) - 1;	// -1 - to use >=
		this.week_size_ms = this.bars_count * this.ms_in_day;
		this.year_size_ms = this.bars_count * this.ms_in_month * 2;
		this.min_date = new Date(now - this.week_size_ms);
		this.min_year_date = new Date(new Date(now.getFullYear() + "-" + (now.getMonth()+1) + "-01") - this.year_size_ms);
		this.colors = ["#1f78b4", "#fb9a99", "#cab2d6", "#6a3d9a", "#b15928", "#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d", "#b2df8a", "#666666", "#a6cee3", "#17becf", "#bcbd22", "#e377c2", "#999999"];
		this.top_infected_percent_limit = 5;

		this.data = new Covid19Data(this.bars_count*2, myPath, this.config.lang);

		this.PrepareTooltips();
		this.LoadDataAsync(myPath).then( ()=>self.InitFirstForm() );
		window.addEventListener("pageshow", (event) => {
			if (event.persisted && self.d3_global_box)
			{
				self.d3_global_box.parentNode.removeChild(self.d3_global_box);
				delete self.d3_global_box;
				self.LoadDataAsync(myPath).then( ()=>self.InitFirstForm() );
			}
		});
	}

	PrepareTooltips()
	{
		// tooltips
		var single_tooltip = new Covid19SingleTooltip();
		this.ShowHideHint = function(event, data, idx, els_list)
		{
			single_tooltip.ShowHideHint(this, data, idx, els_list);
			event.stopPropagation();
			return false;
		};
		document.addEventListener("click", (event) => {
			var sender = event.target;
			var matches;
			if ((sender.tagName == "A") && (matches = sender.href.match(/#([a-z_]+)$/)))
			{
				let anchor = d3.select('.Cv19SMW .footnotes LI A[name="'+matches[1]+'"]').node();
				if (anchor)
				{
/*
					let hint_text = anchor.parentNode.innerText.replace(/^[\[\]0-9]+ /, "");
					single_tooltip.ShowHideHint(sender, hint_text);
					event.stopPropagation();
					return false;
*/
					let footnotes;
					if (footnotes = d3.select(".Cv19SMW .footnotes.collapsed").node())
						footnotes.classList.remove("collapsed");

//					anchor.parentNode.classList.add("selected");
				}
			}

			if (!sender.classList.contains("Cv19SMWtooltiptext"))
				single_tooltip.HideHint();
		});
	}

	LoadDataAsync()
	{
		// https://github.com/CSSEGISandData/COVID-19
		// https://yandex.ru/maps/api/covid?ajax=1&csrfToken=82ee0c3048e1b63ae9493a2e325426e85d10340e%3A1584918398
		// https://www.ecdc.europa.eu/en/publications-data/download-todays-data-geographic-distribution-covid-19-cases-worldwide
		// https://github.com/ulklc/covid19-timeseries/blob/master/report/raw/rawReport.csv
		// https://coronadatascraper.com/

//		var data_source_prefix = "/direct/js/";
		var data_source_prefix = "https://sailormax.github.io/data/";

		var sources = {
				"merged":			data_source_prefix+"covid-19/31days_covid19_merged_global.csv",
				"country_borders":	data_source_prefix+"geo/country_borders.csv",
				"merged_months":	data_source_prefix+"covid-19/24months_covid19_merged_global.csv",
				};
		if (this.config.lang != "en")
		{
			sources["country_names"]	= data_source_prefix+"geo/translates/countries/"+this.config.lang+".csv";
			sources["region_names"]		= data_source_prefix+"geo/translates/regions/"+this.config.lang+".csv";
		}

		return this.data.AppendDataByUrlAsync("my_merged", sources);
	}

	InitFirstForm()
	{
		// to use this object inside events!
		this.ChangeCountry = this.ChangeCountry.bind(this);
		this.RemoveCountry = this.RemoveCountry.bind(this);

		this.InitBaseStructure();

		this.data.ApplyCountrySumGroups();

		this.min_date = new Date(this.data.max_ts - this.week_size_ms); // better use max_ts-week_size, but currently we don't have max_ts + it can be wrong
		this.min_year_date = new Date(this.data.max_month_ts - this.year_size_ms);

		// fill country select
//		var d3_base_form = d3.select("#stat_block FORM:first-child");
		var d3_base_form = this.d3_global_box.select("FORM:first-child");
		d3_base_form.select("SELECT")
					.selectAll('option')
					.data( this.data.GetSortedLocalizedCountryList(true) )
					.enter()
					.append('option')
					.property("value", d => d.id)	// source data has spaces around names => better setup value, than use text
					.property("disabled", d => d.id=="-")
					.text( d => d.value);

		// setup default countries
		var d3_country_chooser = d3_base_form.select("SELECT").property("value", "");
		d3_country_chooser.on("change", this.ChangeCountry);
		d3_base_form.selectAll("LABEL INPUT").on("change", this.ChangeCountry);

		// setup default countries
		var cfg_countries = localStorage.getItem('countries');
		if (cfg_countries && !this.config.readonly)	// readonly has to use pre-configured list
		{
			this.default_countries = JSON.parse(cfg_countries);
		}
		else
		{
			// replace config's country codes to names
			this.default_countries = this.default_countries.map(v => {
				let new_name;
				if (v == "auto")
					return v;
				// is code
				if (new_name = this.data.GetCountryNameByCode(v))
					return new_name;
				// unknown country
				if (!this.data.GetCountryByFullName(v))
					return false;
				return v;
			}).filter(v=>v);

			if (!this.default_countries.length || (this.default_countries.indexOf("auto") >= 0))
			{
				// get top countries
				var top_recovered_country = this.data.GetCountryWithLargestValueOf("recovered");
				this.default_countries.push( top_recovered_country.name );
				this.default_countries.push( "World" );

				// remove "auto"
				this.default_countries = this.default_countries.filter(v => v!="auto");
			}
		}

		this.default_countries.forEach( country => {
			if (country.substr)
				this.AddNewCountry(country);
			else
				this.AddNewCountry(country.name, country.with_neighbors, country.active_tab_nr, country.compares_list);
		});

		// restore min-height to reduce when user remove country
		this.d3_global_box.node().parentNode.style.minHeight = "";
	}
	//

	InitBaseStructure()
	{
		var self = this;
		// init box
		let ShowHideDescription = function(){
			var box = this.parentNode;
			if (box.classList.contains("collapsed"))
				box.classList.remove("collapsed");
			else
				box.classList.add("collapsed");
		};

		this.d3_global_box = d3.create("DIV").attr("class", "Cv19SMW");
			let d3_preface = d3.create("DIV").attr("class", "preface collapsed");
			d3_preface.append("A")
						.on("click", ShowHideDescription)
						.text(this.WORDS["what_are_these_charts"])
					.select(function(){ return this.parentNode; })
					.append("UL")
						.selectAll("LI")
						.data(this.PREFACE_LIST)
						.join("LI")
							.property("innerHTML", d => d)
					;
		this.d3_global_box.append(d => d3_preface.node());

			let d3_forms_box = d3.create("DIV").attr("class", "charts_list");
			d3_forms_box.append("FORM")
							.on("submit", ()=>false)
						.append("P")
							.text(this.WORDS["country"])
							.append("SUP")
								.append("A")
								.attr("href", "#sum_country")
								.call( (d3_sel) => d3_sel.node().appendChild( document.createTextNode("[4]") ) )
						.select(function(){ return this.parentNode.parentNode; })
							.call( (d3_sel) => d3_sel.node().appendChild( document.createTextNode(": ") ) )
							.append("SELECT").attr("class", "country")
							.attr("disabled", ()=>self.config.readonly)
							.select(function(){ return this.parentNode })
						.append("INPUT")
							.property("type", "button")
							.property("value", this.WORDS["delete"])
							.attr("class", "remove-btn")
							.style("display", ()=>self.config.readonly?"none":"inline-block")
						.select(function(){ return this.parentNode.parentNode; })
						.append("P")
							.append("LABEL")
								.attr("class", "option jsWithNeighbors")
								.append("INPUT")
									.property("type", "checkbox")
									.property("name", "with_neighbors")
									.attr("disabled", ()=>self.config.readonly)
								.select(function(){ return this.parentNode; })
								.append("SPAN")
									.text(this.WORDS["with_neighbors"])
						;
		this.d3_global_box.append(d => d3_forms_box.node());

			let d3_footnotes = d3.create("DIV").attr("class", "footnotes collapsed");
			d3_footnotes.append("A")
						.on("click", ShowHideDescription)
						.text(this.WORDS["footnotes"])
					.select(function(){ return this.parentNode; })
					.append("UL")
						.selectAll("LI")
						.data(this.FOOTNOTES_LIST)
						.join("LI")
							.property("innerHTML", d => d)
					;
		this.d3_global_box.append(d => d3_footnotes.node());


		// insert into DOM
		if (this.config.target)
		{
			let target = this.config.target;
			if (target.tagName == "SCRIPT")
				target.parentNode.insertBefore(this.d3_global_box.node(), target.nextSibling);
			else
				d3.select(target).node().appendChild(this.d3_global_box.node());
		}
		else
			document.body.insertBefore(this.d3_global_box.node(), document.body.childNodes[0]);
		//
	}

	// methods
	svgAddTestedValues(d3_svg, country_data, x_scale, y_scale)
	{
		var known_tests = country_data.filter( d => d.tested > 0 );
		if (!known_tests.length)
			return;

		var max_new_tested = Covid19DataTools.GetMaxValueFromData(country_data, "tested");
		var min_new_tested = Covid19DataTools.GetMinValueFromData(known_tests, "tested");

		var y3_scale = d3.scaleLinear([Math.ceil(max_new_tested), Math.floor(min_new_tested)], [0, (this.height/3)-this.margin.top-this.margin.bottom]);

		// legend
		d3_svg.append("text")
			.attr("font-family", "sans-serif")
			.attr("font-size", 11)
			.attr("fill", "#c0c0c0")
			.attr("x", Math.round(this.width/2 - this.WORDS["tested"].length/2*5))
			.attr("y", 10)
			.text(this.WORDS["tested"]);

		// dots
		var d3_mean_line = d3.line()
							.x( d => x_scale(d.date)+Math.round(x_scale.bandwidth()/2) )
							.y( d => y3_scale(d.tested) + this.margin.top )
							.defined( d => d.tested > 0 );
		d3_svg.append("path")
			.attr("d", d3_mean_line(country_data))
			.attr("stroke", "#c0c0c0")
			.attr("fill", "none");

		var funcGetX = d => x_scale(d.date)+Math.round(x_scale.bandwidth()/2)-3;
		var funcGetTestedY = d => y3_scale(d.tested) + this.margin.top - 3;
		var funcGetConfirmedY = d => y_scale(d.confirmed) + this.margin.top;

		d3_svg.append("g")
			.selectAll("rect")
			.data( country_data )
			.enter()
			.append("rect")
			.attr("x", funcGetX )
			.attr("y", funcGetTestedY )
			.attr("width", 6)
			.attr("height", 6)
			.attr("fill", "#c0c0c0")
			.style("visibility", d => d.tested ? "visible" : "hidden")
			.on("click", this.ShowHideHint)
			.append("title")	// hint
				.text(d => Covid19DataTools.GetFormattedNumber(d.tested, true));

		// find nearest values
		var sorted_values = known_tests
							.sort( (d1, d2) => d1.tested - d2.tested )
							.reduce( (list, d) => { list.push(d.tested); return list; }, [] );
		var funcFindPairs = function(values, diff_percent)
		{
			var diff_ratio = diff_percent / 100;
			return values.reduce( (lists, d, i, arr) =>
			{
				if (i > 0)
				{
					if (Math.min(arr[i], arr[i-1]) / Math.max(arr[i], arr[i-1]) >= diff_ratio)
					{
						if (!lists[lists.length] || !lists[lists.length].length)
							lists[lists.length] = [ arr[i-1] ];
						lists[lists.length-1].push(arr[i]);
					}
					else if (lists[lists.length] && lists[lists.length].length)
						lists.push([]);
				}
				return lists;
			}, []);
		};
		var nearests = [];
		var percent = 100;
		do
		{
			nearests = funcFindPairs(sorted_values, percent--);
		} while (percent >= 90 && !nearests.length);

		// out nearest
		if (nearests.length)
		{
			// remove cross pairs
			var nearests_values = nearests.flat();
			var duplicate_values = nearests_values.reduce( (list, v, idx, src) => { if (idx && (src[idx-1] == v) && (list.indexOf(v) < 0)) list.push(v); return list; }, [] );
			if (duplicate_values.length)
			{
				for (var v of duplicate_values)
				{
					nearests
						.reduce( (indexes, pair, idx) => { if (pair.indexOf(v) >= 0) indexes.push({idx:idx, diff:Math.abs(pair[0]-pair[1])}); return indexes; }, [] )
						.sort( (a,b) => a.diff-b.diff )
						.forEach( (el, idx) => { if (idx > 0) delete nearests[el.idx]; } )
						;
					nearests = nearests.filter( el => el );
				}
			}

			// display dots
			var colors = ["#b138cb55", "#604dac55", "#99660055"];
			if (nearests.length > colors.length)
				nearests.splice(colors.length);
			var i, cnt = nearests.length;
			for (i=0; i<cnt; i++)
			{
				var min_value = Math.min.apply(Math, nearests[i]);
				var max_value = Math.max.apply(Math, nearests[i]);
				var min_day = country_data.find( d => d.tested == min_value );
				var max_day = country_data.find( d => d.tested == max_value );

				d3_svg.append("circle")
					.attr("r", 2)
					.attr("cx", funcGetX(min_day)+3 )
					.attr("cy", funcGetTestedY(min_day)+3 )
					.attr("fill", colors[i].substr(0, 7))
					.append("title")	// hint
						.text( Covid19DataTools.GetFormattedNumber(min_day.tested, true) );

				d3_svg.append("circle")
					.attr("r", 2)
					.attr("cx", funcGetX(max_day)+3 )
					.attr("cy", funcGetTestedY(max_day)+3 )
					.attr("fill", colors[i].substr(0, 7))
					.append("title")	// hint
						.text( Covid19DataTools.GetFormattedNumber(max_day.tested, true) );
/*
				d3_svg.append("line")
					.style("stroke-dasharray", ("3, 3"))
					.attr("stroke", colors[i])
					.attr("x1", funcGetX(min_day)+3)
					.attr("y1", funcGetConfirmedY(min_day))
					.attr("x2", funcGetX(max_day)+3)
					.attr("y2", funcGetConfirmedY(max_day));
*/
			}
		}

	}

	GetInfectedCountPer(daily_changes, days, scale, population)
	{
		var days_data = daily_changes.slice(-days);
		var confirmed = days_data.reduce((sum, el) => sum+el.confirmed, 0);
		if (scale && (population > 0))
		{
			var population_percent = confirmed / population;	// TODO: population - country confirmed?
			confirmed = scale * population_percent;
		}
		return confirmed;
	}

	GetPredictionValues(contag_data, regression_method, daily_changes, population)
	{
		var infected_level = Math.ceil( this.GetInfectedCountPer(daily_changes, this.calc_days, 100000, population) );
		if (infected_level > 0 && infected_level < 21)	// Is it good value?
		{
			return [this.WORDS["already_passed"], this.WORDS["almost_done"]];
		}

		var values = [this.WORDS["already_passed"], this.WORDS["in_the_past"]];

		// based on contag
		var full_recovery_days = 14;		// 2 weeks
		var full_recovery_ms = full_recovery_days * this.ms_in_day;

		var last_value_diff = regression_method.func( regression_method.last_learn_day_id ) - regression_method.func( regression_method.last_learn_day_id - 1 );
		if (last_value_diff > 0)
		{
			values = [this.WORDS["growth_detected"], this.WORDS["more_action_required"]];
		}
		else if (regression_method.invert_func)
		{
			var peak_day_idx = Math.ceil( regression_method.invert_func(1) );	// When we will have Contag = 1?
			var end_day_idx = Math.ceil( regression_method.invert_func(0) );	// When we will have Contag = 0?

			var zero_day_ms = contag_data[contag_data.length-this.calc_days-1].date-0;
			var peak_day = new Date(zero_day_ms + peak_day_idx*this.ms_in_day);
			var end_day = new Date(zero_day_ms + end_day_idx*this.ms_in_day + full_recovery_ms);

			if (isFinite(peak_day_idx) && (peak_day_idx > this.calc_days+1))
			{
				if (peak_day_idx > 180)	// +half year
					values[0] = this.WORDS["slowdown_is_too_small"];
				else
					values[0] = Covid19DataTools.formatDate(peak_day);
			}

			if (isFinite(end_day_idx) && (end_day_idx > this.calc_days + 1 - full_recovery_days))
			{
				if (end_day_idx > 180)	// +half year
					values[1] = this.WORDS["not_soon_more_action_required"];
				else
					values[1] = Covid19DataTools.formatDate(end_day);
			}
		}
		else // search step by step
		{
			var start_day_ms = contag_data[ contag_data.length-1 ].date-0;
			var cur_day_idx = regression_method.last_learn_day_id;
			var start_day_idx = cur_day_idx;

			var curr_contag = regression_method.func(cur_day_idx);
			if (curr_contag == 1)
				values[0] = this.WORDS["now"];
			else if (curr_contag > 1)
			{
				// search peakcur_day_idx
				var peak_idx = Covid19DataTools.FindValueByRegression(regression_method.func, 1, cur_day_idx, this.calc_days);
				if (peak_idx !== null)
				{
					values[0] = Covid19DataTools.formatDate(new Date(start_day_ms + (peak_idx - start_day_idx)*this.ms_in_day) );
					cur_day_idx = peak_idx;	// let continue search the finish
				}
				else
					values[0] = this.WORDS["slowdown_is_too_small"];
			}

			var curr_contag = regression_method.func(cur_day_idx);
			if (curr_contag >= 0.05)
			{
				// search finish
				var finish_idx = Covid19DataTools.FindValueByRegression(regression_method.func, 0, cur_day_idx, this.calc_days);
				if (finish_idx !== null)
				{
					values[1] = Covid19DataTools.formatDate(new Date(start_day_ms + (finish_idx - start_day_idx)*this.ms_in_day + full_recovery_ms) );	// + calc_days_ms - for full recovery
				}
				else
					values[1] = this.WORDS["not_soon_more_action_required"];
			}
		}
		return values;
	}

	ShowAnalytic(box, country_name, with_neighbors)
	{
		var self = this;
		var population = 0;
		var country_data = null;
		var chart_country_name = country_name;
		var last_day_is_empty = false;
		var countries_list = this.data.GetCountriesByGroupName(country_name, true, with_neighbors);
		if (!countries_list)
		{
			var country_timeline = this.data.GetTimelineByCountryName(country_name);
			population = this.data.GetPopulationByCountryName(country_name);

			var last_day_key = Object.keys(country_timeline).slice(-1)[0];
			last_day_is_empty = !country_timeline[last_day_key].confirmed;

			var daily_changes = this.data.GetChangesByDateData(country_timeline);

			country_data = this.data.GetLimitedDaysByCountryName(country_name, (new Date()-this.ms_in_day*3));	// data for last 3 days
		}
		else // global data
		{
			var countries_timeline = null;
			if (countries_list.length)
				countries_timeline = this.data.GetTimelineByCountryName(countries_list);
			else // Wolrd
			{
				countries_timeline = this.data.GetTimelineWithoutCountryDuplicates();
				countries_list = this.data.GetAllCountryNames();
			}

			var last_day_key = Object.keys(countries_timeline).slice(-1)[0];
			var first_country_key = Object.keys(countries_timeline[last_day_key]).slice(-1)[0];
			last_day_is_empty = !countries_timeline[last_day_key][first_country_key].confirmed;

			var daily_changes = this.data.GetChangesByDateData(countries_timeline, true);


			countries_list.map(function(country_name)
			{
				var country_population = self.data.GetPopulationByCountryName(country_name);
				if (country_population)
					population += country_population;
			});
			if (!population)
				population = this.data.GetPopulationByCountryName(country_name);

			country_data = this.data.GetLimitedDaysByTimeline(countries_timeline, (new Date()-this.ms_in_day*3));	// data for last 3 days
			country_data = country_data.map(function(day)
			{
				var cumulative_values = { date:null };
				for (var country_name in day)
				{
					if (country_name == "date")	// exception
					{
						cumulative_values.date = day.date;
						continue;
					}
					else
					{
						var country = day[country_name];
						for (var val_type in country)
						{
							if (!cumulative_values[val_type])
								cumulative_values[val_type] = country[val_type];
							else
								cumulative_values[val_type] += country[val_type];
						}
					}
				}
				return cumulative_values;
			});
		}

		// create detached element
		var d3_box = d3.create("div")
						.attr("class", "svg");
		var d3_tools = d3_box.append("div")
						.attr("class", "toolbar");
		var d3_table = d3_box.append("table")
						.attr("class", "analytic_data")
						.attr("width", this.width);

		var funcRecalculateValues = function()
		{
			var no_syptoms_ratio = 3;
			var calc_days = d3_box.select(".infected_per_period TD INPUT").property("value");
			var scale = d3_box.select(".infected_per_x TD INPUT").property("value");
			var use_asymptomatic = d3_tools.select("INPUT.use_asymptomatic").property("checked");

			var asymp_ratio = use_asymptomatic ? 3 : 1;

			var infected_per_period = self.GetInfectedCountPer(daily_changes, calc_days);
			d3_box.select(".infected_per_period TD:nth-child(2)")
				.text( (use_asymptomatic ? "≥ " : "") + Covid19DataTools.GetFormattedNumber(infected_per_period*asymp_ratio, true) );
			var infected_per_x = self.GetInfectedCountPer(daily_changes, calc_days, scale, population);
			var out_infected_per_x = infected_per_x*asymp_ratio;
			if (out_infected_per_x >= 1)
				out_infected_per_x = Math.ceil(out_infected_per_x);
			else
				out_infected_per_x = Math.ceil(out_infected_per_x*100000)/100000;
			d3_box.select(".infected_per_x TD:nth-child(2)")
				.text( (use_asymptomatic ? "≥ " : "") + Covid19DataTools.GetFormattedNumber( out_infected_per_x, true ) );
			d3_box.select(".infected_1_per_x TD:nth-child(2)")
				.text( (use_asymptomatic ? "≤ " : "") + Covid19DataTools.GetFormattedNumber( infected_per_x ? Math.floor(scale / (infected_per_x*asymp_ratio)) : 0, true ) );

			var last_day_data = country_data[ country_data.length-1 ];
			if (!last_day_data.confirmed && (country_data.length > 1))
				last_day_data = country_data[ country_data.length-2 ];

			var total_infected = last_day_data.confirmed * asymp_ratio;
			var total_infected_percent = 0;
			if (population > 0)
				total_infected_percent = Covid19DataTools.GetFormattedNumber(Math.round((total_infected / population)*100000)/1000, true) + "%";
			total_infected = Covid19DataTools.GetFormattedNumber(total_infected, true);
			d3_box.select(".total_infected TD:nth-child(2)")
				.text( (use_asymptomatic ? "≥ " : "") + (total_infected_percent ? total_infected_percent : total_infected) )
				.attr("title", (total_infected_percent ? total_infected : ""));

			var vaccined = last_day_data.vaccined;
			if (vaccined > 0)
			{
				var vaccined_percent = 0;
				if (population > 0)
					vaccined_percent = Covid19DataTools.GetFormattedNumber(Math.round((vaccined / population)*100000)/1000, true) + "%";
				vaccined = Covid19DataTools.GetFormattedNumber(vaccined, true);
				d3_box.select(".vaccined TD:nth-child(2)")
					.text( (vaccined_percent ? vaccined_percent : vaccined) )
					.attr("title", (vaccined_percent ? vaccined : ""));
			}
			else	// no vaccines data
			{
				d3_box.select(".vaccined TD:nth-child(2)")
					.text( self.WORDS["unknown"] );
			}

			var deaths = last_day_data.deaths;
//			var recovered = last_day_data.recovered;
			var confirmed = last_day_data.confirmed;
			var deaths_per_confirmed = "?";
			if (confirmed > 0)
				deaths_per_confirmed = Covid19DataTools.GetFormattedNumber(Math.round((deaths / (deaths+confirmed))*100000)/1000, true);
			d3_box.select(".deaths_per_confirmed TD:nth-child(2)")
				.text( deaths_per_confirmed + "%" )
				.attr("title", (deaths ? Covid19DataTools.GetFormattedNumber(deaths, true) : "?") + " / " + (confirmed ? Covid19DataTools.GetFormattedNumber(confirmed, true) : "?"));

			box["myCalcDays"] = calc_days;	// remember for country switch
			box["myScale"] = scale;
		};

//		var calc_days = this.calc_days;
		var calc_days = 14;	// better use official values
		if (box["myCalcDays"] !== undefined)
			calc_days = box["myCalcDays"];
		var default_scale = 100000;
		var scale = default_scale;
		if (box["myScale"] !== undefined)
			scale = box["myScale"];

		// settings
		d3_tools.append("label")
			.append("input")
				.attr("type", "checkbox")
				.attr("class", "use_asymptomatic")
				.on("input", funcRecalculateValues)
			.select(function(){ return this.parentNode; })
			.append("span")
				.text(this.WORDS["use_asymptomatic"])
			.select(function(){ return this.parentNode; })
			.append("sup")
				.append("a")
					.attr("href", "#asymptomatic")
					.text("[5]");

		// infected
		d3_table.append("tr").attr("class", "infected_per_period")
			.append("td")
				.append("span").text(this.WORDS["infected_per_period"])
				.select(function(){ return this.parentNode; })
				.append("input").attr("type", "number")
					.attr("min", "1")
					.attr("max", daily_changes.length)
					.attr("value", calc_days)
					.on("input", funcRecalculateValues)
					.on("keydown", function() { if (event.keyCode == 27) { this.value = calc_days; funcRecalculateValues(); } })
				.select(function(){ return this.parentNode; })
				.append("span").text(this.WORDS["days"])
			.select(function(){ return this.parentNode.parentNode; })
			.append("td");

		// per 100,000
		d3_table.append("tr").attr("class", "infected_per_x")
			.append("td").append("span").text(this.WORDS["infected_per_x"])
				.select(function(){ return this.parentNode; })
				.append("input")
					.attr("type", "number")
					.attr("min", "0")
					.attr("value", scale)
					.on("input", funcRecalculateValues)
					.on("keydown", function() { if (event.keyCode == 27) { this.value = default_scale; funcRecalculateValues(); } })
				.select(function(){ return this.parentNode; })
				.append("span").text(this.WORDS["of_persons"])
			.select(function(){ return this.parentNode.parentNode; })
			.append("td");

		// each 1 per X
		d3_table.append("tr").attr("class", "infected_1_per_x")
			.append("td").append("span").text(this.WORDS["infected_1_per_x"])
			.select(function(){ return this.parentNode.parentNode; })
			.append("td");


		// figure
		var contag_data = this.data.GetContagiosusByDateData(daily_changes, "confirmed", this.calc_days);
		contag_data = Covid19DataTools.GetSimpleMovingWeightedAverage(contag_data, "value", this.calc_days, 2);
		if (last_day_is_empty)
			contag_data.pop();
		// store box general values
		box["myContagData"] = contag_data;
		contag_data = this.data.GetDataByMinDate( contag_data, this.min_date );

		var xy_list = box["myContagData"].map((d,idx) => [idx, d.value]);
		var regression_method = Covid19DataTools.GetBestRegressionMethod(xy_list, contag_data.length);
		box["myRegressionMethod"] = regression_method;
		d3_table.append("tr").attr("class", "change_figure")
			.append("td")
				.text(this.WORDS["figure_of_change"])
			.select(function(){ return this.parentNode; })
			.append("td")
				.text(this.WORDS[regression_method.name]);

		// contag
		var contag_diff = contag_data[contag_data.length-1].value - contag_data[contag_data.length-2].value;
		d3_table.append("tr").attr("class", "contag_koef")
			.append("td")
				.append("span")
					.text(this.WORDS["contag_koef"])
				.select(function(){ return this.parentNode; })
				.append("sup")
					.append("a")
						.attr("href", "#contagiosus")
						.text("[2]")
			.select(function(){ return this.parentNode.parentNode.parentNode; })
			.append("td")
				.append("span").text(contag_data[contag_data.length-1].value)
				.select(function(){ return this.parentNode; })
				.append("span").text( () => { return (contag_diff < 0 ? "▼" : (contag_diff > 0 ? "▲" : "")); } )
					.attr("style", () => { return "color:"+(contag_diff < 0 ? "#1aca1a" : (contag_diff > 0 ? "red" : "")); } );


		// predictions
		var predictions = this.GetPredictionValues(box["myContagData"], box["myRegressionMethod"], daily_changes, population);

		// peak
		d3_table.append("tr")
			.attr("class", "possible_peak")
			.append("td")
				.text(this.WORDS["possible_peak"])
			.select(function(){ return this.parentNode; })
			.append("td")
				.text(predictions[0]);

		// finish
		d3_table.append("tr")
			.attr("class", "possible_finish")
			.append("td")
				.text(this.WORDS["possible_finish"])
			.select(function(){ return this.parentNode; })
			.append("td")
				.text(predictions[1]);

		// total
		d3_table.append("tr")
			.attr("class", "total_infected")
			.append("td")
				.text( this.WORDS["total_infected"].charAt(0).toUpperCase() + this.WORDS["total_infected"].slice(1) )
			.select(function(){ return this.parentNode; })
			.append("td");

		// vaccined
		d3_table.append("tr")
			.attr("class", "vaccined")
			.append("td")
				.text( this.WORDS["vaccined"].charAt(0).toUpperCase() + this.WORDS["vaccined"].slice(1) )
				.append("SUP")
					.append("A")
					.attr("href", "#vaccined")
					.call( (d3_sel) => d3_sel.node().appendChild( document.createTextNode("[6]") ) )
					.select(function(){ return this.parentNode; })
				.select(function(){ return this.parentNode; })
			.select(function(){ return this.parentNode; })
			.append("td");

		// deaths per recovered
		d3_table.append("tr")
			.attr("class", "deaths_per_confirmed")
			.append("td")
				.text( this.WORDS["deaths_per_confirmed"].charAt(0).toUpperCase() + this.WORDS["deaths_per_confirmed"].slice(1) )
				.select(function(){ return this.parentNode; })
			.append("td");

		// attach element to DOM
		d3.select(box).append( () => d3_box.node() );
		funcRecalculateValues();
	}

	ShowContagiosus(box, country_name, with_neighbors)
	{
		var chart_country_name = country_name;
		var countries_list = this.data.GetCountriesByGroupName(country_name, true, with_neighbors);
		if (!countries_list)
		{
			var country_timeline = this.data.GetTimelineByCountryName(country_name);

			var daily_changes = this.data.GetChangesByDateData(country_timeline);
			var country_data = this.data.GetDataByMinDate( daily_changes, this.min_date );
		}
		else // global data
		{
			var countries_timeline = null;
			if (countries_list.length)
				countries_timeline = this.data.GetTimelineByCountryName(countries_list);
			else // Wolrd
				countries_timeline = this.data.GetTimelineWithoutCountryDuplicates();

			var daily_changes = this.data.GetChangesByDateData(countries_timeline, true);
			if (countries_list["is_sum_country"] && !daily_changes[0].tested)
			{
				// copy tested from sum-country
				var sum_country_daily_changes = this.data.GetChangesByDateData(countries_list["is_sum_country"].timeline);
				for (var i in daily_changes)
					if (daily_changes[i].date-0 == sum_country_daily_changes[i].date-0)
						daily_changes[i].tested = sum_country_daily_changes[i].tested;
			}

			var country_data = this.data.GetDataByMinDate( daily_changes, this.min_date );

			// show details for global confirmed
			for (var day of country_data)
			{
				day.countries.sort( (c1, c2) => c2.confirmed - c1.confirmed );	// desc
				var top_countries = [];
				var top_sum = 0;
				var min_value = day.confirmed/100 * this.top_infected_percent_limit;
				if (min_value > 0)
					for (var country of day.countries)
					{
						if (country.confirmed >= min_value)
						{
							top_countries.push(country);
							top_sum += country.confirmed;
						}
						else
							break;
					}
				if ((day.confirmed-top_sum) > 0)
					top_countries.push( {name:"other", confirmed:day.confirmed-top_sum} );
				day.top_countries = top_countries;
			}
		}
/*
		var contag_data = this.data.GetContagiosusByDateData(daily_changes, "confirmed", this.calc_days);
		contag_data = Covid19DataTools.GetSimpleMovingWeightedAverage(contag_data, "value", this.calc_days, 2);
		// store box general values
		box["myContagData"] = contag_data;
		contag_data = this.data.GetDataByMinDate( contag_data, this.min_date );
*/
		var contag_data = this.data.GetDataByMinDate( box["myContagData"], this.min_date );

		// create detached element
		var d3_box = d3.create("div")
						.attr("class", "svg");
		var d3_svg = d3_box.append("svg")
						.attr("width", this.width)
						.attr("height", this.height);

		// axis
		var x_scale = d3.scaleBand(this.data.GetDaysListFromData(country_data), [this.margin.left, this.width - this.margin.left]).paddingInner(0.5).paddingOuter(0.5);
		var prev_date = null;
		d3_svg.append("g")
			.attr("transform", "translate(0,"+(this.height - this.margin.bottom)+")")
			.call(d3.axisBottom(x_scale).tickFormat( d => Covid19DataTools.formatDate(d) ))
			.selectAll("text")
				.attr("color", dt => ((dt.getDay() || 7) > 5 ? "#888888" : "black"));

		var max_new_confirmed = Covid19DataTools.GetMaxValueFromData(country_data, "confirmed");
//			var max_new_recovered = Covid19DataTools.GetMaxValueFromData(country_data, "recovered");
//			var max_new_deaths = Covid19DataTools.GetMaxValueFromData(country_data, "deaths");
		var has_infections = max_new_confirmed > 0;

		var y_scale = d3.scaleLinear([Math.ceil(max_new_confirmed*1.3), 0], [0, this.height-this.margin.top-this.margin.bottom]);
//			var y_scale = d3.scaleLinear([Math.ceil(Math.max(max_new_confirmed, max_new_recovered, max_new_deaths)*1.3), 0], [0, height-margin.top-margin.bottom]);
		d3_svg.append("g")
			.attr("transform", "translate("+this.margin.left+","+this.margin.top+")")
			.attr("color", "steelblue")
			.call(d3.axisLeft(y_scale))
			.call(g => g.selectAll(".tick")
						.each((val, idx, arr) => {
								if (val >= Covid19DataTools.largetNumberLimiter)
									d3.select(arr[idx]).selectAll("text").text( Covid19DataTools.GetFormattedNumber(val) );
						})
			)
			.call(g => g.select(".domain").remove());

//			var y2_scale = d3.scaleLinear([Math.ceil(Covid19DataTools.GetMaxValueFromData(contag_data)*1.3), 0], [0, height-margin.top-margin.bottom]);
//			var y2_scale = d3.scaleLog([Math.ceil(Covid19DataTools.GetMaxValueFromData(contag_data)*1.3), 0.1], [0, height-margin.top-margin.bottom]).base(1);
		var y2_scale = d3.scaleSymlog([Math.ceil(Covid19DataTools.GetMaxValueFromData(contag_data)*1.3), 0], [0, this.height-this.margin.top-this.margin.bottom]).constant(10);
		d3_svg.append("g")
			.attr("transform", "translate("+(this.width-this.margin.right)+","+(this.margin.top)+")")
			.attr("color", "red")
			.call(d3.axisRight(y2_scale))
			.call(g => g.selectAll(".tick")
						.each((val, idx, arr) => {
								if (val < 1)
									d3.select(arr[idx]).selectAll("line, text").attr("color", "#00aa00");
								else if (val === 1)
									d3.select(arr[idx]).selectAll("line, text").attr("color", "orange");
						})
				)
			.call(g => g.select(".domain").remove());
		//

		// axis labels
		d3_svg.append("text")
			.attr("font-family", "sans-serif")
			.attr("font-size", 11)
			.attr("fill", "steelblue")
			.attr("x", 0)
			.attr("y", 10)
			.text(this.WORDS["new_infected"]);

		d3_svg.append("text")
			.attr("font-family", "sans-serif")
			.attr("font-size", 11)
			.attr("fill", "red")
			.attr("x", this.width - 70)
			.attr("y", 10)
			.text(this.WORDS["contagiosus"]+"**");

		if (has_infections)
		{
/*
			// deaths bars
			var d3_virt_bars = d3_svg.append("g")
				.attr("fill", "red")
				.selectAll("rect")
				.data(country_data)
				.join("rect")
					.attr("x",		d => x_scale(d.date)-2)
					.attr("y",		d => y_scale(d.deaths) + margin.top)
					.attr("height",	d => Math.max(0, y_scale(0) - y_scale(d.deaths)))
					.attr("width",	3)
					.on("click",	ShowHideHint)
					.append("title")	// hint
						.text(d => GetFormattedNumber(d.deaths));

			// recovered bars
			var d3_virt_bars = d3_svg.append("g")
				.attr("fill", "green")
				.selectAll("rect")
				.data(country_data)
				.join("rect")
					.attr("x",		d => x_scale(d.date)+x_scale.bandwidth()-1)
					.attr("y",		d => y_scale(d.recovered) + margin.top)
					.attr("height",	d => Math.max(0, y_scale(0) - y_scale(d.recovered)))
					.attr("width",	3)
					.on("click",	ShowHideHint)
					.append("title")	// hint
						.text(d => GetFormattedNumber(d.recovered));
*/
			// confirmed bars
			var d3_virt_bars = d3_svg.append("g")
				.attr("fill", "steelblue")
				.selectAll("rect")
				.data(country_data);
			if (!countries_list)
			{
				d3_virt_bars.join("rect")
					.attr("x",		d => x_scale(d.date))
					.attr("y",		d => y_scale(d.confirmed) + this.margin.top)
					.attr("height",	d => Math.max(0, y_scale(0) - y_scale(d.confirmed)))
					.attr("width",	x_scale.bandwidth())
					.on("click",	this.ShowHideHint)
					.append("title")	// hint
						.text(d => Covid19DataTools.GetFormattedNumber(d.confirmed));
			}
			else
			{
				// setup country colors
				var country_color = {};
				var color_idx = 0;
				country_data.forEach( d => d.top_countries.forEach( c => { if (!country_color[c.name]) country_color[c.name] = this.colors[color_idx++]; } ) );
				if (country_color["other"])
					country_color["other"] = this.colors[ this.colors.length-1 ];

				// collect all top countries for constant colors
				d3_virt_bars.join("g")
					.selectAll("rect")
					.data(d => {
						var offsetY = y_scale(d.confirmed) + this.margin.top;
						d.top_countries.forEach((row, idx) =>
						{
							row.date = d.date;
							row.x = x_scale(d.date);
							row.y = offsetY;
							row.height = Math.max(0, y_scale(0) - y_scale(row.confirmed));
							row.color = country_color[ row.name ];
							row.label = this.data.GetLocalizedName(row.name) + ": " + Covid19DataTools.GetFormattedNumber(row.confirmed) + " (" + Math.round(row.confirmed/d.confirmed*100) + "%) / " + Covid19DataTools.GetFormattedNumber(d.confirmed);

							offsetY += row.height;
						});
						return d.top_countries;
					})
					.join("rect")
						.attr("x",		d => d.x)
						.attr("y",		d => d.y)
						.attr("height",	d => d.height)
						.attr("width",	x_scale.bandwidth())
						.attr("fill",	d => d.color)
						.on("click",	this.ShowHideHint)
						.append("title")	// hint
							.text(d => d.label)

				// legend in actual countries
				var country_names, labels = [];
				var last_known_day = country_data[ country_data.length-1 ];
				if (!last_known_day.top_countries.length)	// sometime statistic of last day is unknown
					last_known_day = country_data[ country_data.length-2 ];
				last_known_day.top_countries.forEach( c => labels.push( {
																		id: (c.name == "other" ? null : c.name),
																		value: c.name,
																		color: country_color[c.name]
																		} ) );
				if (labels.length && (labels.length < (country_names = Object.keys(country_color)).length))
				{
					labels.forEach( l => { var idx; if ((idx = country_names.indexOf(l.value)) >= 0) delete country_names[idx]; } );

					// remove `other` from list
					var other;
					if (!labels[ labels.length-1 ].id)
					{
						other = labels.pop();
						other.id = null;
					}

					// add more countries
					for (var country_name of country_names)
						if (country_name)
							labels.push( {id:country_name, value:country_name, color:country_color[country_name]} )

					// put `other` back to list
					if (other)
						labels.push(other);
				}

				// remove country from name or localize it
				if (labels.length > 0)
					labels.forEach( l => l.value = this.data.GetLocalizedName(l.value) );

				d3_box.append("UL")
					.attr("class", "legend")
					.selectAll("LI")
					.data(labels)
					.join("LI")
					.append(d =>
					{
						var node = d3.create(d.id ? "A" : "SPAN").node();
						if (d.id)
							node.addEventListener("click", ()=>this.ShowTheCountryStat(d.id, box));
						return node;
					})
					.attr( "style", d => "border-left:10px solid "+d.color )
					.text( d => d.value );
			}

			// limit
			d3_svg.append("line")
				.attr("stroke", "orange")
				.attr("x1", this.margin.left+10)
				.attr("y1", y2_scale(1) + this.margin.top)
				.attr("x2", this.width - this.margin.left)
				.attr("y2", y2_scale(1) + this.margin.top);
		}

		// tested
		this.svgAddTestedValues(d3_svg, country_data, x_scale, y_scale);


		// contag
		var d3_mean_line = d3.line()
							.x( d => x_scale(d.date)+Math.round(x_scale.bandwidth()/2) )
							.y( d => y2_scale(d.value) + this.margin.top);
		d3_svg.append("path")
			.attr("d", d3_mean_line(contag_data))
			.attr("stroke", d => (has_infections ? "red" : "#1aca1a"))
			.attr("fill", "none");

		d3_svg.append("g")
			.selectAll("circle")
			.data( contag_data )
			.enter()
			.append("circle")
			.attr("r", 3)
			.attr("cx", d => x_scale(d.date)+Math.round(x_scale.bandwidth()/2) )
			.attr("cy", d => y2_scale(d.value) + this.margin.top )
			.attr("fill", d => (d.value < 1 ? "#1aca1a" : "red"))
			.on("click", this.ShowHideHint)
			.append("title")	// hint
				.text(d => d.value);

		// regression
		var xy_list = box["myContagData"].map((d,idx) => [idx, d.value]);
//		var regression_method = Covid19DataTools.GetBestRegressionMethod(xy_list, contag_data.length);
//		box["myRegressionMethod"] = regression_method;
		var regression_method = box["myRegressionMethod"];
		var contag_func = regression_method.func;
		var idx_shift = xy_list[xy_list.length-1][0] - regression_method.last_learn_day_id;
		xy_list =  xy_list.slice(xy_list.length-contag_data.length);		// work only with latest data
		if (contag_func)
		{
			var new_xy_list = xy_list.map( (d,idx) => [ idx, contag_func(d[0]-idx_shift) ] );

			var start_date = contag_data[0].date;
			var d3_line = d3.line()
							.x( d => x_scale(new Date(start_date-0 + d[0]*this.ms_in_day))+Math.round(x_scale.bandwidth()/2) )
							.y( d => y2_scale(d[1]) + this.margin.top);
			d3_svg.append("path")
				.style("stroke-dasharray", ("3, 3"))
				.attr("d", d3_line(new_xy_list))
				.attr("stroke", "#ff000033")
				.attr("fill", "none");
		}

		// attach element to DOM
		d3.select(box).append( () => d3_box.node() );
	}

	ShowCumulative(box, country_name, with_neighbors)
	{
		var self = this;
		var population = 0;
		var country_data = null;
		var countries_list = this.data.GetCountriesByGroupName(country_name, false, with_neighbors);
		if (!countries_list)
		{
			country_data = this.data.GetLimitedDaysByCountryName(country_name, this.min_date-this.week_size_ms);
			population = this.data.GetPopulationByCountryName(country_name);
		}
		else
		{
			var countries_timeline = null;
			if (countries_list.length)
				countries_timeline = this.data.GetTimelineByCountryName(countries_list);
			else // Wolrd
				countries_timeline = this.data.GetTimelineWithoutCountryDuplicates();

			country_data = this.data.GetLimitedDaysByTimeline(countries_timeline, this.min_date-this.week_size_ms);

			var last_day_date = country_data[ country_data.length-1 ].date;
			country_data = country_data.map(function(day)
			{
				var is_last_day = (last_day_date == day.date);
				var cumulative_values = { date:null };
				for (var country_name in day)
				{
					if (country_name == "date")	// exception
					{
						cumulative_values.date = day.date;
						continue;
					}
					else
					{
						var country = day[country_name];
						for (var val_type in country)
						{
							if (!cumulative_values[val_type])
								cumulative_values[val_type] = country[val_type];
							else
								cumulative_values[val_type] += country[val_type];
						}
					}

					if (is_last_day)
					{
						var country_population = self.data.GetPopulationByCountryName(country_name);
						if (country_population)
							population += country_population;
					}
				}
				return cumulative_values;
			});

			if (!population)
				population = this.data.GetPopulationByCountryName(country_name);
		}

		// calc week ago value
		var first_day_minus_week = country_data[0];
		first_day_minus_week.infected = first_day_minus_week.confirmed - (first_day_minus_week.recovered||0 + first_day_minus_week.deaths||0);

		// leave only required data
		country_data.splice(0, country_data.length-this.bars_count-1);

		// join data
		country_data = country_data.map(
							function(el, idx, arr)
							{
								el.tested = el.tested || 0;
								el.confirmed = el.confirmed || 0;
								el.recovered = el.recovered || 0;
								el.deaths = el.deaths || 0;

								el.infected = el.confirmed - (el.recovered + el.deaths);

								if (el.confirmed)
								{
									el.infected_percent = Math.round(el.infected / el.confirmed * 1000) / 10;
									el.recovered_percent = Math.round(el.recovered / el.confirmed * 1000) / 10;
									el.deaths_percent = Math.round(el.deaths / el.confirmed * 1000) / 10;
								}
								else
								{
									el.infected_percent = 0;
									el.recovered_percent = 0;
									el.deaths_percent = 0;
								}

								return el;
							}
		);
		var last_day_data = country_data[country_data.length-1];
		if (!last_day_data.confirmed)	// sometimes last day data can be undefined (will be later)
			last_day_data = country_data[country_data.length-2];

		// create detached element
		var d3_box = d3.create("div")
						.attr("class", "svg");
		var d3_svg = d3_box.append("svg")
						.attr("width", this.width)
						.attr("height", this.height);

		// axis
		var x_scale = d3.scaleBand(this.data.GetDaysListFromData(country_data), [this.margin.left, this.width - this.margin.left]).paddingInner(0.5).paddingOuter(0.5);
		d3_svg.append("g")
			.attr("transform", "translate(0,"+(this.height - this.margin.bottom)+")")
			.call(d3.axisBottom(x_scale).tickFormat( d => Covid19DataTools.formatDate(d) ))
			.selectAll("text")
				.attr("color", dt => ((dt.getDay() || 7) > 5 ? "#888888" : "black"));

		var max_confirmed = Covid19DataTools.GetMaxValueFromData(country_data, "confirmed");
		var has_infections = max_confirmed > 0;

		var y_scale = d3.scaleLinear([Math.ceil(max_confirmed*1.3), 0], [0, this.height-this.margin.top-this.margin.bottom]);
		d3_svg.append("g")
			.attr("transform", "translate("+this.margin.left+","+this.margin.top+")")
			.call(d3.axisLeft(y_scale))
			.call(g => g.selectAll(".tick")
						.each((val, idx, arr) => {
								if (val >= Covid19DataTools.largetNumberLimiter)
									d3.select(arr[idx]).selectAll("text").text( Covid19DataTools.GetFormattedNumber(val) );
						})
			)
			.call(g => g.select(".domain").remove());
		//

		// get confirmed percent of population
		var population_percent = null;
		if (population > 0)
			population_percent = Math.round(last_day_data.confirmed / population * 100000) / 1000;

		d3_svg.append("text")
			.attr("font-family", "sans-serif")
			.attr("font-size", 11)
			.attr("y", 10)
			.text(this.WORDS["total_infected"]
				+ (last_day_data.confirmed > 0
					? " (" + Covid19DataTools.GetFormattedNumber(last_day_data.confirmed)
						+ (population > 0
							? " = "+population_percent+"% / "+Covid19DataTools.GetFormattedNumber(population, true)
							: "")
						+ ")"
					: ""));

		if (has_infections)
		{
			// bars
			var d3_stack = d3.stack()
							.keys(["deaths", "recovered", "infected"])
							.order(d3.stackOrderNone)
							.offset(d3.stackOffsetNone);

			d3_svg.append("g")
				.selectAll("g")
				.data( d3_stack(country_data) )
				.join("g")
				.selectAll("rect")
				.data(d => {
					d.forEach(row => (row.key = d.key));
					return d;
				})
				.join("rect")
					.attr("x",		d => x_scale(d.data.date))
					.attr("y",		d => y_scale(d[1]) + this.margin.top)
					.attr("height",	d => Math.max(0, y_scale(d[0]) - y_scale(d[1])))
					.attr("width",	x_scale.bandwidth())
					.attr("fill", d => {
						if (d.key == "deaths")
							return "red";
						if (d.key == "recovered")
							return "green";
						if (d.key == "infected")
							return "orange";
					})
					.on("click", this.ShowHideHint)
					.append("title")	// hint
						.text(d => this.WORDS[d.key] + ": " + Covid19DataTools.GetFormattedNumber(d.data[d.key]) + " ("+d.data[d.key+"_percent"]+"%) / " + Covid19DataTools.GetFormattedNumber(d.data.confirmed));

			// arrow of infected
			var first_day = country_data[0];
			var last_day = country_data[country_data.length-1];
			if (!last_day.confirmed)	// last day has not data (its will be later)
				last_day = country_data[country_data.length-2];

			d3_svg.append("marker")
				.attr("id", "arrow")
				.attr("fill", "orange")
				.attr("viewBox", "0 -5 10 10")
				.attr("refX", 5)
				.attr("refY", 0)
				.attr("markerWidth", 7)
				.attr("markerHeight", 7)
				.attr("orient", "auto")
					.append("path")
						.attr("d", "M0,-5L10,0L0,5");

			d3_svg.append("line")
				.attr("stroke", "orange")
				.attr("marker-end", "url(#arrow)")
				.attr("x1", x_scale(first_day.date) + x_scale.bandwidth()/2)
				.attr("y1", y_scale(first_day.confirmed)+10)
				.attr("x2", x_scale(last_day.date) + x_scale.bandwidth()/2)
				.attr("y2", y_scale(last_day.confirmed)+10);

			var funcAppendPercentValue = function(d3_svg, first_day, last_day, x, y)
			{
				var diff_value = last_day.infected - first_day.infected;
				if (first_day.infected)
					var diff_percent = Math.round(diff_value / first_day.infected * 1000) / 10;
				else
					var diff_percent = 0;
				if (diff_percent > 10 || diff_percent < -10)	// large numbers do not require so accuracy value (save space)
					diff_percent = Math.round(diff_percent);

				d3_svg.append("text")
						.attr("x", x)
						.attr("y", y)
						.attr("font-family", "sans-serif")
						.attr("font-size", 12)
						.attr("fill", "orange")
						.text((diff_percent > 0 ? "+" : "")+Covid19DataTools.GetFormattedNumber(diff_percent)+"%")
						.append("title")
							.text((diff_percent > 0 ? "+" : "")+Covid19DataTools.GetFormattedNumber(diff_value));
			};

			// increase level of previous week
			funcAppendPercentValue(d3_svg, first_day_minus_week, first_day, x_scale(first_day.date) - x_scale.bandwidth(), y_scale(first_day.confirmed)+5);

			// increase level of last week
			funcAppendPercentValue(d3_svg, first_day, last_day, x_scale(last_day.date) + x_scale.bandwidth(), y_scale(last_day.confirmed)+10 + 4);

			// store box general values
/*
			box["myCumulativeValues"] = {
										first_day_minus_week: first_day_minus_week,
										first_day: first_day,
										last_day: last_day
										};
*/
			// legend
			var self = this;
			Array(
				{ x:this.margin.left+10, color:"red", text:this.WORDS["deaths"] + (last_day.confirmed > 0 ? " ("+Covid19DataTools.GetFormattedNumber(Math.round(last_day.deaths/last_day.confirmed*1000)/10)+"%)" : "") },
				{ x:this.margin.left+115, color:"green", text:this.WORDS["recovered"] + (last_day.recovered > 0 ? " ("+Covid19DataTools.GetFormattedNumber(Math.round(last_day.recovered/last_day.confirmed*1000)/10)+"%)***" : "***") },
				{ x:this.margin.left+270, color:"orange", text:this.WORDS["was_infected"] + (last_day.infected > 0 ? " ("+Covid19DataTools.GetFormattedNumber(last_day.infected)+")" : "") },
			).forEach(function(label)
			{
				var d3_legend = d3_svg.append("g").attr("fill", label.color);
				d3_legend
					.append("rect")
						.attr("x", label.x)
						.attr("y", self.margin.top)
						.attr("width", 10)
						.attr("height", 10);
				d3_legend.append("text")
						.attr("x", label.x + 15)
						.attr("y", self.margin.top+9)
						.attr("font-family", "sans-serif")
						.attr("font-size", 12)
						.text(label.text);
			});
		}

		// attach element to DOM
		d3.select(box).append( () => d3_box.node() );
	}

	ShowVaccinationResult(box, country_name, with_neighbors)
	{
		var self = this;
		var population = 0;
		var chart_country_name = country_name;
		var countries_list = this.data.GetCountriesByGroupName(country_name, true, with_neighbors);
		if (!countries_list)
		{
			var country_timeline = this.data.GetMonthsTimelineByCountryName(country_name);

			var daily_changes = this.data.GetChangesByDateData(country_timeline);
			var country_data = this.data.GetDataByMinDate( daily_changes, this.min_year_date );

			population = this.data.GetPopulationByCountryName(country_name);
		}
		else // global data
		{
			var countries_timeline = null;
			if (countries_list.length)
				countries_timeline = this.data.GetMonthsTimelineByCountryName(countries_list);
			else // Wolrd
				countries_timeline = this.data.GetMonthsTimelineWithoutCountryDuplicates();

			var daily_changes = this.data.GetChangesByDateData(countries_timeline, true);
			if (countries_list["is_sum_country"] && !daily_changes[0].tested)
			{
				// copy tested from sum-country
				var sum_country_daily_changes = this.data.GetChangesByDateData(countries_list["is_sum_country"].timeline);
				for (var i in daily_changes)
					if (daily_changes[i].date-0 == sum_country_daily_changes[i].date-0)
						daily_changes[i].tested = sum_country_daily_changes[i].tested;
			}

			var country_data = this.data.GetDataByMinDate( daily_changes, this.min_year_date );

			countries_list.map(function(country_name)
			{
				var country_population = self.data.GetPopulationByCountryName(country_name);
				if (country_population)
					population += country_population;
			});
			if (!population && country_data.length)
				country_data[country_data.length-1].countries.map(function(country)
				{
					var country_population = self.data.GetPopulationByCountryName(country.name);
					if (country_population)
						population += country_population;
				});
			if (!population)
				population = this.data.GetPopulationByCountryName(country_name);
		}

		if (!population)
			population = 0;

		// create detached element
		var d3_box = d3.create("div")
						.attr("class", "svg");
		var d3_tools = d3_box.append("div")
						.attr("class", "toolbar");
		var d3_svg = d3_box.append("svg")
						.attr("width", this.width)
						.attr("height", this.height + 12);	// plus space for second row of x-axis titles

		var funcRecalculateValues = function()
		{
			var show_absolute_values = d3_tools.select("INPUT.show_absolute_values").property("checked");

			d3_svg.selectAll("*").remove();
			var last_good_month_nr = country_data[country_data.length-2].date.getMonth();

			// axis
			var x_scale = d3.scaleBand(self.data.GetDaysListFromData(country_data), [self.margin.left, self.width - self.margin.right]).paddingInner(0.5).paddingOuter(0.5);
			d3_svg.append("g")
				.attr("transform", "translate(0,"+(self.height - self.margin.bottom)+")")
	//			.call(d3.axisBottom(x_scale).tickFormat( (d, k) => Math.floor(country_data[k].total_vaccined / population * 100)+"%" ))
				.call(d3.axisBottom(x_scale).tickFormat(""))
				.selectAll("text")
				.append('tspan')
				.text( (d, k) => Math.floor(country_data[k].total_vaccined / population * 100) )
					.attr("x", "0")
					.attr("dy", "0.71em")
					.attr("font-size", 9)
					.append("title")	// hint
						.text( (d, k) => Covid19DataTools.numberFormat(country_data[k].total_vaccined) )
					.select( function(){ return this.parentNode.parentNode; } )
				.append('tspan')
				.text( (d, k) => Covid19DataTools.formatMonthOnly(country_data[k].date) )
					.attr("x", "0")
					.attr("dy", "1.3em")
					.attr("font-size", 7)
					.attr("font-weight", (d) => (d.getMonth() === last_good_month_nr ? "bold" : "regular") );
			d3_svg.append("text")
					.attr("font-size", 9)
					.attr("x", (self.width - self.margin.right - 4))
					.attr("y", (self.height - self.margin.bottom + 15))
					.text( "%" )
					.select( function(){ return this.parentNode; } )
				.append("text")
					.attr("font-size", 7)
					.attr("x", self.margin.left - 15)
					.attr("y", (self.height - self.margin.bottom + 25))
					.text( Covid19DataTools.formatYearOnly(country_data[0].date) )
					.select( function(){ return this.parentNode; } )
				.append("text")
					.attr("font-size", 7)
					.attr("x", (self.width - self.margin.right - 4))
					.attr("y", (self.height - self.margin.bottom + 25))
					.text( Covid19DataTools.formatYearOnly(country_data[country_data.length-1].date) )
					.select( function(){ return this.parentNode; } );


			var funcDeathsValue;
			var funcDeathsTitleValue;
			var funcConfirmedValue;
			var funcConfirmedTitleValue;
			if (show_absolute_values)
			{
				funcDeathsValue = function(d) { return (population ? Math.round(d.deaths / population * 100000) : d.deaths) };
				funcDeathsTitleValue = function(d) { return Covid19DataTools.numberFormat(population ? Math.round(d.deaths / population * 100000) : d.deaths) + " ("+Covid19DataTools.numberFormat(d.deaths)+")" };
				funcConfirmedValue = function(d) { return (population ? Math.round(d.confirmed / population * 100000) : d.confirmed); }
				funcConfirmedTitleValue = function(d) { return Covid19DataTools.numberFormat(population ? Math.round(d.confirmed / population * 100000) : d.confirmed) + " ("+Covid19DataTools.numberFormat(d.confirmed)+")" };
			}
			else
			{
				funcDeathsValue = function(d) { return (d.confirmed ? (d.deaths / d.confirmed * 100) : d.deaths) };
				funcDeathsTitleValue = function(d) { return Covid19DataTools.minimizeFloat(d.confirmed ? (d.deaths / d.confirmed * 100) : d.deaths) + "% ("+Covid19DataTools.numberFormat(d.deaths)+")" };
				funcConfirmedValue = function(d) { return d.confirmed; }
				funcConfirmedTitleValue = function(d) { return Covid19DataTools.numberFormat(d.confirmed) };
			}

			var deaths_per_confirmed = country_data.map( funcDeathsValue );
			var max_death_per_confirm = Math.max(...deaths_per_confirmed);

			var y_scale = d3.scaleLinear([Math.ceil(max_death_per_confirm*1.3), 0], [0, self.height-self.margin.top-self.margin.bottom]);
			d3_svg.append("g")
				.attr("transform", "translate("+self.margin.left+","+self.margin.top+")")
				.attr("color", "red")
				.call(d3.axisLeft(y_scale))
				.call(g => g.selectAll(".tick")
							.each((val, idx, arr) => {
									if (val >= Covid19DataTools.largetNumberLimiter)
										d3.select(arr[idx]).selectAll("text").text( Covid19DataTools.GetFormattedNumber(val) );
							})
				)
				.call(g => g.select(".domain").remove());

			var confirmed_list = country_data.map( funcConfirmedValue );
			var max_new_confirmed = Math.max(...confirmed_list);

			var y2_scale = d3.scaleLinear([Math.ceil(max_new_confirmed*1.3), 0], [0, self.height-self.margin.top-self.margin.bottom]);
			d3_svg.append("g")
				.attr("transform", "translate("+(self.width-self.margin.right)+","+(self.margin.top)+")")
				.attr("color", "steelblue")
				.call(d3.axisRight(y2_scale))
				.call(g => g.selectAll(".tick")
							.each((val, idx, arr) => {
									if (val >= Covid19DataTools.largetNumberLimiter)
										d3.select(arr[idx]).selectAll("text").text( Covid19DataTools.GetFormattedNumber(val) );
							})
				)
				.call(g => g.select(".domain").remove());
			//

			// background tolerance levels
			if (show_absolute_values)
			{
				var tolerance_area = d3.area()
										.x( d => x_scale(d.date) + x_scale.bandwidth()/2 )
										.y0( d => y2_scale(0) + self.margin.top )
										.y1( d => y2_scale(d.value) + self.margin.top );
				var normal_levels = country_data.map(d => {return { "date": d.date, "value": self.data.VRTI_LEVELS[d.date.getMonth()+1][0] };});
				var tolerance_levels = country_data.map(d => {return { "date": d.date, "value": self.data.VRTI_LEVELS[d.date.getMonth()+1][1] };});
				d3_svg.append("g")
					.selectAll()
					.data([tolerance_levels])
					.join("path")
						.attr("fill", "#fdfbec")
						.attr("d", tolerance_area)
					.append("title")
						.text(self.WORDS["vrti_high_forecast"]);
				d3_svg.append("g")
					.selectAll()
					.data([normal_levels])
					.join("path")
						.attr("fill", "#eaffea")
						.attr("d", tolerance_area)
					.append("title")
						.text(self.WORDS["vrti_mid_forecast"]);
			}

			// axis labels
			d3_svg.append("text")
				.attr("font-family", "sans-serif")
				.attr("font-size", 11)
				.attr("fill", "red")
				.attr("x", 0)
				.attr("y", 10)
				.text( (show_absolute_values ? self.WORDS["deaths"] : self.WORDS["deaths_per_confirmed_percent"]).toLowerCase());

			if (show_absolute_values)
				d3_svg.append("text")
					.attr("font-family", "sans-serif")
					.attr("font-size", 11)
					.attr("fill", "#c0c0c0")
					.attr("x", Math.round(self.width/2 - self.WORDS["per_100k"].length/2*5))
					.attr("y", 10)
					.text(self.WORDS["per_100k"]);

			d3_svg.append("text")
				.attr("font-family", "sans-serif")
				.attr("font-size", 11)
				.attr("fill", "steelblue")
				.attr("x", self.width - 120)
				.attr("y", 10)
				.text(self.WORDS["new_infected"]);

	//		if (has_deaths)
			{
				// confirmed bars
				var d3_virt_bars = d3_svg.append("g")
					.attr("fill", "steelblue")
					.selectAll()
					.data(country_data);

				d3_virt_bars.join("rect")
					.attr("x",		d => x_scale(d.date))
					.attr("y",		d => y2_scale(funcConfirmedValue(d)) + self.margin.top)
					.attr("height",	d => Math.max(0, y2_scale(0) - y2_scale(funcConfirmedValue(d))))
					.attr("width",	x_scale.bandwidth())
					.attr("fill-opacity","0.3")
					.on("click",	self.ShowHideHint)
					.append("title")	// hint
						.text( d => funcConfirmedTitleValue(d) );

				d3_virt_bars.join("circle")
					.attr("r", 3)
					.attr("cx", d => x_scale(d.date) + Math.round(x_scale.bandwidth()/2) )
					.attr("cy", d => y_scale( funcDeathsValue(d) ) + self.margin.top )
					.attr("fill", "red")
					.on("click",	self.ShowHideHint)
					.append("title")	// hint
						.text( d => funcDeathsTitleValue(d) );
			}

			// regression of deaths
			var death_ratios = country_data.map( d => ({ "date":d.date, "value":funcDeathsValue(d) }) );
			if (show_absolute_values)
				death_ratios.pop();	// remove last month, because it is not finished
//			var moving_average_data = Covid19DataTools.GetSimpleMovingWeightedAverage(death_ratios, "value", death_ratios.length, 2);
//			var xy_list = moving_average_data.map((d,idx) => [idx, d.value]);
			var xy_list = death_ratios.map((d,idx) => [idx, d.value]);
//			var regression_method = Covid19DataTools.GetBestRegressionMethod(xy_list, moving_average_data.length);
			var regression_method = Covid19DataTools.GetBestRegressionMethod(xy_list, death_ratios.length);
			var contag_func = regression_method.func;
			var idx_shift = xy_list[xy_list.length-1][0] - regression_method.last_learn_day_id;
			xy_list =  xy_list.slice(xy_list.length-death_ratios.length);		// work only with latest data
			if (contag_func)
			{
				var new_xy_list = xy_list.map( (d,idx) => [ idx, contag_func(d[0]-idx_shift) ] );

				var start_date = death_ratios[0].date;
				var d3_line = d3.line()
//								.x( d => { return x_scale(moving_average_data[d[0]].date)+Math.round(x_scale.bandwidth()/2) } )
								.x( d => { return x_scale(death_ratios[d[0]].date)+Math.round(x_scale.bandwidth()/2) } )
								.y( d => y_scale(d[1]) + self.margin.top);
				d3_svg.append("path")
					.style("stroke-dasharray", ("3, 3"))
					.attr("d", d3_line(new_xy_list))
					.attr("stroke", "#ff000033")
					.attr("fill", "none");
			}

			// regression of infections
			var confirmed_ratios = country_data.map( d => ({ "date":d.date, "value":funcConfirmedValue(d) }) );
			confirmed_ratios.pop();	// remove last month, because it is not finished
//			var moving_average_data = Covid19DataTools.GetSimpleMovingWeightedAverage(confirmed_ratios, "value", confirmed_ratios.length, 2);
//			var xy_list = moving_average_data.map((d,idx) => [idx, d.value]);
			var xy_list = confirmed_ratios.map((d,idx) => [idx, d.value]);
//			var regression_method = Covid19DataTools.GetBestRegressionMethod(xy_list, moving_average_data.length);
			var regression_method = Covid19DataTools.GetBestRegressionMethod(xy_list, confirmed_ratios.length);
			var contag_func = regression_method.func;
			var idx_shift = xy_list[xy_list.length-1][0] - regression_method.last_learn_day_id;
			xy_list =  xy_list.slice(xy_list.length-confirmed_ratios.length);		// work only with latest data
			if (contag_func)
			{
				var new_xy_list = xy_list.map( (d,idx) => [ idx, contag_func(d[0]-idx_shift) ] );

				var start_date = confirmed_ratios[0].date;
				var d3_line = d3.line()
//								.x( d => { return x_scale(moving_average_data[d[0]].date)+Math.round(x_scale.bandwidth()/2) } )
								.x( d => { return x_scale(confirmed_ratios[d[0]].date)+Math.round(x_scale.bandwidth()/2) } )
								.y( d => y2_scale(d[1]) + self.margin.top);
				d3_svg.append("path")
					.style("stroke-dasharray", ("3, 3"))
					.attr("d", d3_line(new_xy_list))
					.attr("stroke", "#0000ff33")
					.attr("fill", "none");
			}
		};

		// settings
		d3_tools.append("label")
			.append("input")
				.attr("type", "checkbox")
				.attr("class", "show_absolute_values")
				.on("input", funcRecalculateValues)
			.select(function(){ return this.parentNode; })
			.append("span")
				.text(this.WORDS["show_absolute_mortality_values"]);

		funcRecalculateValues();

		// attach element to DOM
		d3.select(box).append( () => d3_box.node() );
	}

	ShowComparsions(box, country_name, with_neighbors)
	{
		var self = this;

		// create detached element
		var d3_box = d3.create("div")
						.attr("class", "svg");
		var d3_svg = d3_box.append("svg")
						.attr("width", this.width)
						.attr("height", this.height);

		var funcGetCountryData = function(country_name)
		{
			var country_data = null;
			var population = 0;
			var chart_country_name = country_name;
			var countries_list = self.data.GetCountriesByGroupName(country_name, true);		// without neighbors!
			if (!countries_list)
			{
				var country_timeline = self.data.GetTimelineByCountryName(country_name);
				population = self.data.GetPopulationByCountryName(country_name);

				var daily_changes = self.data.GetChangesByDateData(country_timeline);

//				country_data = self.data.GetLimitedDaysByCountryName(country_name, self.min_date-self.week_size_ms);
			}
			else // global data
			{
				var countries_timeline = null;
				if (countries_list.length)
					countries_timeline = self.data.GetTimelineByCountryName(countries_list);
				else // Wolrd
				{
					countries_timeline = self.data.GetTimelineWithoutCountryDuplicates();
					countries_list = self.data.GetAllCountryNames();
				}

				var daily_changes = self.data.GetChangesByDateData(countries_timeline, true);

				countries_list.map(function(country_name)
				{
					var country_population = self.data.GetPopulationByCountryName(country_name);
					if (country_population)
						population += country_population;
				});
				if (!population)
					population = self.data.GetPopulationByCountryName(country_name);
/*
				country_data = self.data.GetLimitedDaysByTimeline(countries_timeline, self.min_date-self.week_size_ms);
				country_data = country_data.map(function(day)
				{
					var cumulative_values = { date:null };
					for (var country_name in day)
					{
						if (country_name == "date")	// exception
						{
							cumulative_values.date = day.date;
							continue;
						}
						else
						{
							var country = day[country_name];
							for (var val_type in country)
							{
								if (!cumulative_values[val_type])
									cumulative_values[val_type] = country[val_type];
								else
									cumulative_values[val_type] += country[val_type];
							}
						}
					}
					return cumulative_values;
				});
*/
			}

			// calc per 100k
			var two_week_sum = 0;
			var two_week_values = [];
			daily_changes.map(
							function(el, idx, arr)
							{
								if (two_week_values.length == 14)
									two_week_sum -= two_week_values.shift();
								two_week_values.push( el.confirmed );
								two_week_sum += el.confirmed;

								el.per100k = (two_week_sum / population) * 100000;
								if (el.per100k > 0.1)
									el.per100k = Math.ceil(el.per100k);
								else
									el.per100k = 0;

								return el;
							}
			);

			// leave only required data
			daily_changes.splice(0, daily_changes.length-self.bars_count-1);
			if (!daily_changes[ daily_changes.length-1 ].total_confirmed)		// sometimes currently last day is undefined (data will be later)
				daily_changes[ daily_changes.length-1 ].per100k = daily_changes[ daily_changes.length-2 ].per100k;

			return daily_changes;
		};


		var funcDrawAxis = function(x_scale, y_scale)
		{
			d3_svg.append("text")
				.attr("font-family", "sans-serif")
				.attr("font-size", 11)
				.attr("y", 10)
				.text(self.WORDS["infected_per_x"].toLowerCase() + " 100,000 " + self.WORDS["of_persons"] + " " + self.WORDS["over_the_past"] + " 14 " + self.WORDS["days"]);

			// x-axis
			d3_svg.append("g")
				.attr("transform", "translate(0,"+(self.height - self.margin.bottom)+")")
				.call(d3.axisBottom(x_scale).tickFormat( d => Covid19DataTools.formatDate(d) ))
				.selectAll("text")
					.attr("color", dt => ((dt.getDay() || 7) > 5 ? "#888888" : "black"));

			// y-axis
			d3_svg.append("g")
				.attr("transform", "translate("+self.margin.left+","+self.margin.top+")")
				.call(d3.axisLeft(y_scale))
				.call(g => g.selectAll(".tick")
							.each((val, idx, arr) => {
									if (val >= Covid19DataTools.largetNumberLimiter)
										d3.select(arr[idx]).selectAll("text").text( Covid19DataTools.GetFormattedNumber(val) );
							})
				)
				.call(g => g.select(".domain").remove());
		}

		var funcDrawCompanyData = function(country_name, daily_changes, color, x_scale, y_scale)
		{
			// per100k
			var d3_mean_line = d3.line()
								.x( d => x_scale(d.date)+Math.round(x_scale.bandwidth()/2) )
								.y( d => y_scale(d.per100k) + self.margin.top);
			d3_svg.append("path")
				.attr("d", d3_mean_line(daily_changes))
				.attr("stroke", color)
				.attr("fill", "none");

			d3_svg.append("g")
				.selectAll("rect")
				.data( daily_changes )
				.enter()
				.each( function(d, idx, arr) {
					var angle = 0;
					if ((idx == arr.length-1) && (d.per100k != daily_changes[idx-1].per100k))
						angle = ((d.per100k < daily_changes[idx-1].per100k) ? 180 : 360);

					if (!angle)
					{
						d3.select(this)
							.append("rect")
								.attr("x", d => x_scale(d.date)+Math.round(x_scale.bandwidth()/2) - 3 )
								.attr("y", d => y_scale(d.per100k) + self.margin.top - 3 )
								.attr("width", 6)
								.attr("height", 6)
								.attr("fill", color)
								.on("click", self.ShowHideHint)
								.append("title")	// hint
									.text(d => self.data.GetLocalizedName(country_name)+": "+d.per100k);
					}
					else	// angle only for triangles
					{
						d3.select(this)
							.append("path")
								.attr("d", d3.symbol().type(d3.symbolTriangle).size(30))
								.attr("transform", d => "translate("
																+(x_scale(d.date)+Math.round(x_scale.bandwidth()/2))
																+", "
																+(y_scale(d.per100k) + self.margin.top)
																+"), rotate("+angle+")")
								.attr("fill", color)
								.on("click", self.ShowHideHint)
								.append("title")	// hint
									.text(d => self.data.GetLocalizedName(country_name)+": "+d.per100k);
					}
				})
			//
		};

		var base_country = country_name;
		var funcDrawCompareData = function(country_names)
		{
			// clear old data
			d3_svg.selectAll("*").remove();
			d3_box.selectAll("UL").remove();

			// init
			var color_idx = 0;
			var country_color = {};
			var labels = [];
			var countries_data = {};
			var min_per100k = -1;
			var max_per100k = 0;

			for (var country_name of country_names)
			{
				country_color[ country_name ] = self.colors[color_idx++];
				labels.push(
					{
						id:		(base_country!=country_name ? country_name : null),
						value:	self.data.GetLocalizedName(country_name),
						color:	country_color[country_name],
						country_name: country_name
					}
				);
				countries_data[ country_name ] = funcGetCountryData( country_name );
				// limit used colors
				if (color_idx >= self.colors.length)
					color_idx--;

				var local_max_per100k = Covid19DataTools.GetMaxValueFromData(countries_data[ country_name ], "per100k");
				if (max_per100k < local_max_per100k)
					max_per100k = local_max_per100k;

				var local_min_per100k = Covid19DataTools.GetMinValueFromData(countries_data[ country_name ], "per100k");
				if ((min_per100k > local_min_per100k) || (min_per100k == -1))
					min_per100k = local_min_per100k;
			}
			//

			if (min_per100k == -1)
				min_per100k = 0;

			// axis
			var x_scale = d3.scaleBand(self.data.GetDaysListFromData(countries_data[base_country]), [self.margin.left, self.width - self.margin.left]).paddingInner(0.5).paddingOuter(0.5);
//			var y_scale = d3.scaleLinear([Math.ceil(max_per100k*1.3), 0], [0, self.height-self.margin.top-self.margin.bottom]);
			var y_scale = d3.scaleSymlog([Math.ceil(max_per100k*1.3), min_per100k*0.7], [0, self.height-self.margin.top-self.margin.bottom]).constant(30);
			funcDrawAxis(x_scale, y_scale);
			//

			var last_values = [];
			for (var country_name of country_names)
			{
				var country_data = countries_data[ country_name ];
				funcDrawCompanyData( country_name, country_data, country_color[ country_name ], x_scale, y_scale );
				if (country_data[ country_data.length-1 ].per100k > 0)
					last_values.push( country_data[ country_data.length-1 ].per100k );
			}

			// output last values
			var current_group = {y:0, values:[]};
			var last_value_groups = [];
			last_values.sort( (a,b) => b-a );
			for (var last_value of last_values)
			{
				var y = y_scale(last_value) + self.margin.top + 3;
				if (((y - current_group.y) >= 6) && (current_group.values.length > 0))
				{
					last_value_groups.push( current_group );
					current_group = {y:y, values:[last_value]};
				}
				else
				{
					if (current_group.y)
						current_group.y = (y + current_group.y)/2;
					else
						current_group.y = y;	// first item use as is
					current_group.values.unshift( last_value );
				}
			}
			if (current_group.values.length > 0)
				last_value_groups.push( current_group );

			for (var values_group of last_value_groups)
			{
				var values_output = [...new Set(values_group.values)].join(",");	// unique values
				if (values_output.length > 10)
				{
					values_output = values_output.substr(0, 9);
					if (values_output.indexOf(",") > 0)
						values_output = values_output.substr(0, values_output.lastIndexOf(",")+1) + "..";
				}
				d3_svg.append("text")
						.attr("x", (self.width - self.margin.right - 10))
						.attr("y", values_group.y)
						.attr("font-family", "sans-serif")
						.attr("font-size", 10)
						.attr("fill", "black")
						.text( values_output )
						.append("title")	// hint
							.text( values_group.values.join(",") );
			}

			// legend
			d3_box.append("UL")
				.attr("class", "legend")
				.selectAll("LI")
				.data(labels)
				.join("LI")
				.append(d =>
				{
					var node = d3.create(d.id ? "A" : "SPAN").node();
					if (d.id)
						node.addEventListener("click", ()=>self.ShowTheCountryStat(d.id, box));
					return node;
				})
					.attr( "style", d => "border-left:10px solid "+d.color )
					.text( d => d.value )
				.select( function(){ return this.parentNode; } )
				.each( function(d)
				{
					if (!d.id)
						return;

					d3.select(this).append("A")
									.attr("class", "sup_x")
									.property("myCountryName", d.country_name)
									.text("x")
									.on("click", funcRemoveComparsionCountry);
				});
			//
		};

		var compare_country_names = box["myComparesList"] || [];
		var funcCompareWith = function(event)
		{
			if (this.value != "")
			{
				compare_country_names.push( this.value );
				this.options[ this.selectedIndex ].style.display = "none";
				this.value = "";
			}

			funcDrawCompareData(compare_country_names);

			box["myComparesList"] = compare_country_names;
			if (event)
				self.StoreCountriesListCfg();
		};

		var funcRemoveComparsionCountry = function()
		{
			var country2remove = this["myCountryName"];
			compare_country_names = compare_country_names.filter( country => country != country2remove );

			funcDrawCompareData(compare_country_names);
			this.parentNode.remove();
			// reactivate country in selection
			var compareCountry = d3_compareCountry.node();
			for (var option of compareCountry.options)
				if (country2remove == option.value)
				{
					option.style.display = "block";
					break;
				}

			box["myComparesList"] = compare_country_names;
			self.StoreCountriesListCfg();
		};

		var d3_compareCountry = d3_box.append("p")
										.attr("class", "compare_slection")
										.append("span")
											.text(this.WORDS["compare_with"]+": ")
										.select(function(){ return this.parentNode; })
										.append( () => d3.select(box).select("SELECT").node().cloneNode(true) )
											.attr("name", "compare_countries")
											.on("change", funcCompareWith)
											.insert("option", ":first-child")
												.select(function(){ return this.parentNode; });
		if (compare_country_names.length && (compare_country_names.indexOf(base_country) >= 0))		// base_country can be changed => do not just load
		{
			var compareCountry = d3_compareCountry.node();
			for (var option of compareCountry.options)
				if (compare_country_names.indexOf(option.value) >= 0)
					option.style.display = "none";
			d3_compareCountry.property("value", "");
		}
		else
		{
			if (box["myPreviousBaseName"])
				compare_country_names[0] = base_country;			// rewrite first item, because it is previous base country (in most cases)

			if (compare_country_names.indexOf(base_country) < 0)
				d3_compareCountry.property("value", base_country);
			else
				d3_compareCountry.property("value", "");
		}
		box["myPreviousBaseName"] = base_country;
		funcCompareWith.call(d3_compareCountry.node());


		// attach element to DOM
		d3.select(box).append( () => d3_box.node() );
	}

	ActivateTabs(box)
	{
//		if (box.offsetWidth >= ((this.width+12)*3))
//			return;

		// create detached element
		var d3_box = d3.create("div")
						.attr("class", "tabs");
		var d3_row = d3_box.append("table").attr("width", this.width)
						.append("tr");

		// hide charts
		var d3_charts = d3.select(box).selectAll("DIV.svg");
		d3_charts.style("display", "none");

		// setup tabs
		var self = this;
		var onTabClick = function(nr)
		{
			d3_charts.style("display", "none");
			d3_charts.nodes()[nr].style.display = "block";

			d3_row.selectAll("TD").classed("active", false);
			d3_row.select("TD:nth-child("+(nr+1)+")").classed("active", true);

			box["myActiveTabNr"] = nr;
			self.StoreCountriesListCfg();
		};
		d3_row.append("td").append("a").text(this.WORDS["analytics"]).on("click", function() { onTabClick(0); });
		d3_row.append("td").append("a").text(this.WORDS["statistic"]).on("click", function() { onTabClick(1); });
		d3_row.append("td").append("a").text(this.WORDS["results"]).on("click", function() { onTabClick(2); });
		d3_row.append("td").append("a").text(this.WORDS["vactination"]).on("click", function() { onTabClick(3); });
		d3_row.append("td").append("a").text(this.WORDS["comparsions"]).on("click", function() { onTabClick(4); });

		if (box["myActiveTabNr"] !== undefined)
			onTabClick(box["myActiveTabNr"]);
		else
			onTabClick(1);

		// attach element to DOM
		box.insertBefore(d3_box.node(), d3_charts.nodes()[0]);
	}

	StoreCountriesListCfg()
	{
		if (this.config.readonly)
			return;

		var default_countries = [];
//		d3.selectAll("#stat_block FORM").each(function() {
		this.d3_global_box.selectAll("FORM").each(function() {
			var form = this;
			var country_name = form.getElementsByTagName("SELECT")[0].value;
			if (country_name)
			{
				default_countries.push({
										name:			country_name,
										with_neighbors: d3.select(form).select("INPUT[name='with_neighbors']").property("checked"),
										active_tab_nr:	form["myActiveTabNr"],
										compares_list:	form["myComparesList"]
										});
			}
		});

		if (default_countries.length)
			localStorage.setItem('countries', JSON.stringify(default_countries));
		else
			localStorage.removeItem('countries');
	}

	AddNewCountry(country_name, with_neighbors, active_tab_nr, compares_list)
	{
		// change last SELECT
		if (country_name)
		{
			var d3_form = this.d3_global_box.select("FORM:last-child");
			d3_form
				.property("myActiveTabNr", active_tab_nr)
				.property("myComparesList", compares_list);
			if (with_neighbors)
				d3_form.select("INPUT[name='with_neighbors']").property("checked", true);
			d3_form.select("SELECT").property("value", country_name).dispatch("change");
			if (this.config.readonly)
				d3_form.style("display", "block");
			return;
		}

		// add new empty SELECT
		var d3_last_box = this.d3_global_box.select("FORM:last-child");
		d3_last_box = d3_last_box.clone(true);
		d3_last_box.select("SELECT").property("value", "").on("change", this.ChangeCountry);
		d3_last_box.select("LABEL INPUT").property("checked", false).on("change", this.ChangeCountry);
		d3_last_box.selectAll("DIV.svg").remove();
		if (this.config.readonly)
			d3_last_box.style("display", "none");
	}


	ShowTheCountryStat(country_name, sender_box)
	{
		var country_node_finder = el => (el.value == country_name) && !d3.select(el.parentNode.parentNode).select("INPUT[name='with_neighbors']").property("checked");

		// find or create new
//		var country_select = d3.selectAll("#stat_block FORM SELECT").nodes().find( country_node_finder );
		var country_select = this.d3_global_box.selectAll("FORM SELECT").nodes().find( country_node_finder );
		if (!country_select)
		{
			this.AddNewCountry(country_name);
//			country_select = d3.selectAll("#stat_block FORM SELECT").nodes().find( country_node_finder );
			country_select = this.d3_global_box.selectAll("FORM SELECT").nodes().find( country_node_finder );
		}

		// move after sender
		var new_box = country_select.parentNode.parentNode;
		if (sender_box)
		{
			sender_box.parentNode.insertBefore(new_box, sender_box.nextSibling);
			// showing
			d3.select(new_box).style("opacity", "0").transition().style("opacity", "1");
			// changed position => resave
			this.StoreCountriesListCfg();
		}

		// focus
		if (!Covid19DataTools.IsInViewport(new_box))
			new_box.scrollIntoView();
	}

	RemoveCountry()
	{
		var box = event.target.parentNode.parentNode;	// form
		d3.select(box).remove();
		this.StoreCountriesListCfg();
	}

	ChangeCountry()
	{
		var box = event.target;
		while (box && box.tagName != "FORM")
			box = box.parentNode;
		var country_name = box.getElementsByTagName("SELECT")[0].value;

		var d3_svgs = d3.select(box).selectAll("DIV.svg, DIV.tabs");
		if (d3_svgs.size() > 0)
			d3_svgs.remove();
		else
			this.AddNewCountry(null);

		var with_neighbors = false;
		var d3_with_neighbors_label = d3.select(box).select("LABEL.option.jsWithNeighbors");
		var country_code = this.data.GetCodeByCountryName(country_name);
		if ((country_name.indexOf(" / ") > 0 && country_name.indexOf("∑") < 0) || (!this.data.GetCountryNeighbours(country_code) && !this.COUNTRY_GROUPS[country_name]))	// region and no data countries
		{
			d3_with_neighbors_label.style("visibility", "hidden");
			d3_with_neighbors_label.node().parentNode.style.display = "none";
		}
		else	// country
		{
			d3_with_neighbors_label.style("visibility", "visible");
			d3_with_neighbors_label.node().parentNode.style.display = "block";
			with_neighbors = d3_with_neighbors_label.select("INPUT").property('checked');
		}

		if (this.data.countries.length)
		{
			this.ShowAnalytic(box, country_name, with_neighbors);
			this.ShowContagiosus(box, country_name, with_neighbors);
			this.ShowCumulative(box, country_name, with_neighbors);
			this.ShowVaccinationResult(box, country_name, with_neighbors);
			this.ShowComparsions(box, country_name, with_neighbors);

			this.ActivateTabs(box);

			d3.select(box).select("INPUT.remove-btn").style("visibility", "visible").on("click", this.RemoveCountry);
			this.StoreCountriesListCfg();
		}
		else
		{
			d3.select(box).append("DIV").attr("class", "svg").text(this.WORDS["db_not_accessible"]);
		}
	}
}

/*
TODO:
0. top countries by: vaccined percent, sick per 100k, death percent
1. keep compares when change base country
2. compare by overal death?
*/
