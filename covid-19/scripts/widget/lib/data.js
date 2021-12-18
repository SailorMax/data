/*
import Covid19DataTools from "./data_tools.js";
import { Cv19SMW_TOP_REGIONS } from "./shared_data.js";

export default
*/
class Covid19Data
{
	constructor(use_last_x_days, myPath, lang)
	{
		this.CODE_COUNTRY = {};
		this.COUNTRY_GROUPS = {};
		this.TOP_REGIONS = {};

		var self = this;
		d3.json(myPath+"lib/shared_data.json", {cache:"force-cache"}).then(function(data)
		{
			self.COUNTRY_GROUPS = data.COUNTRY_GROUPS;
			self.TOP_REGIONS = data.TOP_REGIONS;

			Object.keys(self.TOP_REGIONS).map(k => { if (self.COUNTRY_GROUPS[ self.TOP_REGIONS[k] ]) self.TOP_REGIONS[k] = self.COUNTRY_GROUPS[ self.TOP_REGIONS[k] ]; });
		});
		d3.json(myPath+"lib/translates/"+lang+".json", {cache:"force-cache"}).then(function(data)
		{
			self.CODE_COUNTRY = data.CODE_COUNTRY;
		});

		this.COUNTRY_BORDERS = {};

		this.use_last_x_days = use_last_x_days;

		this.ms_in_day = 24*60*60*1000;
		this.value_field_names = ["vaccined", "tested", "confirmed", "recovered", "deaths"];

		// will be filled later
		this.countries = [];
		this.timeline = {};
		this.months_timeline = {};
		this.max_ts = 0;
		this.max_month_ts = 0;

		this.code2country = {};
		this.country2code = {};
		this.region2code = {};
	}

	SetChangesPerDay(changes, day, prev_day)
	{
		for (var fname of this.value_field_names)
		{
			if (prev_day)
			{
				changes[fname] = (day[fname]||0) - (prev_day[fname]||0);
				if (changes[fname] <= 0)		// we can have wrong data...
					changes[fname] = 0;
			}
			else
				changes[fname] = (day[fname]||0);
		}
	}

	GetChangesByDateData(country_timeline, day_has_countries)
	{
		var changes = [];
		var prev_day = null;
		for (var ts in country_timeline)
		{
			var day_changes = {
						date: new Date(ts-0),
						};
			var day = country_timeline[ts];
			if (day_has_countries)
			{
				for (var fname of this.value_field_names)
					day_changes[fname] = 0;
				day_changes["total_confirmed"] = 0;
				day_changes["total_vaccined"] = 0;

				var country_changes = [];
				for (var country_name in day)
				{
					var country_day_changes = { name:country_name };

					this.SetChangesPerDay(country_day_changes, day[country_name], prev_day ? prev_day[country_name] : null);

					for (var fname of this.value_field_names)
						day_changes[fname] += country_day_changes[fname];
					day_changes["total_confirmed"] += day[country_name]["confirmed"];
					day_changes["total_vaccined"] += day[country_name]["vaccined"];
					country_changes.push( country_day_changes );
				}

				day_changes.countries = country_changes;
			}
			else
			{
				this.SetChangesPerDay(day_changes, day, prev_day);
				day_changes["total_confirmed"] = day.confirmed;
				day_changes["total_vaccined"] = day.vaccined;
			}

			changes.push( day_changes );
			prev_day = day;
		}
		changes.shift();	// remove first element, because it has not changes
		return changes;
	}

	// compare current day with last week mean value
	GetContagiosusByDateData(daily_infection, fname, calc_days)
	{
		var moving_average_data = Covid19DataTools.GetSimpleMovingWeightedAverage(daily_infection, fname, calc_days, 2);
		return daily_infection.map(
				function(el, idx)
				{
					var diff = 1;	// first day
					if (idx > 0 && moving_average_data[idx-1].value > 0)
						diff = Math.round((el[fname] / moving_average_data[idx-1].value) * 10) / 10;
					if (diff < 0)
						diff = 0;
					return { date:el.date, value:diff };
				}
		);
	}

	GetDataByMinDate(list, date)
	{
		return list.filter( d => d.date >= date );
	}

	GetDaysListFromData(data)
	{
		return Object.keys( data ).map( key => data[key].date );
	}

	GetVaccinedPercentListFromData(data, population)
	{
		if (!population)
			population = 1;
		return Object.keys( data ).map( key => (data[key].total_vaccined / population * 100) );
	}

	GetAllCountryNames()
	{
		var all_countries = [];
		for (var country of this.countries)
		{
			if (country.code.length == 2 && country.region === null)
				all_countries.push(country.name);
		}
		return all_countries;
	}

	GetCountriesByGroupName(name, include_sum_countries, with_neighbors)
	{
		var countries_list = null;
		if (countries_list = this.TOP_REGIONS[name])
		{
			if (countries_list.substr)	// single country
				countries_list = [countries_list];

			// for groups add neighbors of each country
			if (with_neighbors && this.COUNTRY_BORDERS)
			{
				var country_codes = countries_list.map( code => this.code2country[code] ? code : (this.GetCountryByFullName(code) || {}).code );
				countries_list = country_codes.reduce( (list, code) => list.concat( this.COUNTRY_BORDERS[code]||[] ), country_codes ).filter( (v, idx, self) => self.indexOf(v) === idx );
			}

			// convert codes to name
			countries_list = countries_list.map( code => this.code2country[code] || (this.GetCountryByFullName(code) || {}).full_name );
			if (countries_list && countries_list.length == 1 && (include_sum_countries || with_neighbors))	// 1 country is not a group and its real
			{
				name = countries_list[0]
				countries_list = null;
				// try second check (sum_countries) below
			}
			else
				return countries_list;
		}

		if (with_neighbors)
		{
			var country = this.GetCountryByFullName(name);
			if (this.COUNTRY_BORDERS && this.COUNTRY_BORDERS[ country.code ])
			{
				var country_codes = [country.code].concat( this.COUNTRY_BORDERS[ country.code ] );

				// convert codes to name
				countries_list = country_codes.map( code => this.code2country[code] );
				if (countries_list && countries_list.length == 1 && include_sum_countries)	// 1 country is not a group and its real
				{
					name = countries_list[0]
					countries_list = null;
					// try second check (sum_countries)
				}
			}
		}
		else if (include_sum_countries && name.substr(-1) == "∑")
		{
			var country = this.GetCountryByFullName(name);
			var countries_list = country.regions.reduce( (list, region) => { list.push(region.full_name); return list; }, [] );
			countries_list["is_sum_country"] = country;
		}

		return countries_list;
	}


	AppendDataByUrlAsync(provider, data_name, data_url)
	{
		var self = this;
		return new Promise(function(resolve, reject)
		{
			var data_list = data_name;
			if (data_name && data_url)
				data_list = {}, data_list[data_name] = data_url;

			var sources_cnt = 0;
			var request_cnt = 0;
			var failed_cnt = 0;
			var finished_request = function(err_text)
			{
				if (++request_cnt == sources_cnt)
				{
					if (failed_cnt == sources_cnt)
						reject( Error(err_text || "Can't load any data") );
					else
						window.setTimeout(resolve, 1);
				}
			};

			var onSuccess = function(data_name)
			{
				return (raw_data) => { self.AppendData(provider, data_name, raw_data); finished_request(); };
			};

			var data_list = data_name;

			if (Promise.allSettled)
			{
				var names_list = [];
				var req_list = [];
				for (var raw_name in data_list)
				{
					names_list.push(raw_name);
					req_list.push( d3.csv(data_list[raw_name]) );
				}
				sources_cnt = req_list.length;

				Promise.allSettled(req_list).then(
					function(results)
					{
						var cnt = results.length;
						for (var i=0; i<cnt; i++)
						{
							if (results[i].status === "fulfilled")
							{
								onSuccess(names_list[i])( results[i].value );
							}
							else
							{
								failed_cnt++;
								finished_request(results[i].reason);
								console.log(results[i]);
							}
						}
					}
				);
			}
			else
			{
				// back compatibility (one by one)
				for (var raw_name in data_list)
				{
					sources_cnt++;
					d3.csv( data_list[raw_name] ).then(
						onSuccess(raw_name),
						err => { failed_cnt++; finished_request(); }
					);
				}
			}
		});
	};

	AddNewCountry(country_iso, country_name, region_iso, region, population)
	{
		var country_region = region;
		var country_full_name = country_name;
		if (country_region.length)
			country_full_name += " / " + country_region;

		var country = this.GetCountryByFullName(country_full_name);
		if (!country)
		{
			country = {
						code: country_iso || country_name,
						name: country_name,
						region: country_region.length ? country_region : null,
						region_code: region_iso || country_region || null,
						full_name: country_full_name,
						population: population-0,
						timeline: [],
						months_timeline: [],
						};

			this.countries.push(country);

			if (!this.code2country[ country.code ])
				this.code2country[ country.code ] = country.name;
			if (!this.country2code[ country.name ])
				this.country2code[ country.name ] = country.code;
			if (!this.region2code[ country.full_name ])
				this.region2code[ country.full_name ] = country.region_code;
		}
		return country;
	}

	AppendData(provider, data_name, raw_data)
	{
		switch (provider)
		{
/*
			case "CSSEGI":
				var require_cols = [];
				var min_ts = 0;
				for (row of raw_data)
				{
					var country = this.AddNewCountry(null, row["Country/Region"], null, row["Province/State"], 0);

					// calculate min_ts
					if (!min_ts)
					{
						var max_date = Object.keys(row).reduce( (max, key) => { var dt = (new Date(key))-0; return (dt && dt > max ? dt : max); }, 0 );
						min_ts = (new Date(max_date - (week_size_ms*2)))-0;
					}

					// collect require_cols to minimize date recognitions
					if (!require_cols.length)
					{
						var ts, keys = Object.keys(row).reverse();
						for (var k of keys)
						{
							if (!isNaN(k.substr(0, 1)))
							{
								if ((ts=(new Date(k))-0) >= min_ts)
									require_cols.unshift({ name:k, ts:ts });	// put in correct order
								else
									break;	// original list is sorted => if date less than required -> stop calculate others
							}
						}
					}

					// collect required data
					for (var key of require_cols)
					{
						var ts = key.ts;
						if (!country.timeline[ts])
							country.timeline[ts] = {};

						if (data_name == "merged")
						{
							// my format
							var crd = row[key.name].split("/");
							country.timeline[ts]["confirmed"] = crd[0]-0;
							country.timeline[ts]["recovered"] = crd[1]-0;
							country.timeline[ts]["deaths"] = crd[2]-0;
						}
						else
							country.timeline[ts][data_name] = row[key.name]-0;

						if (!this.timeline[ts])
							this.timeline[ts] = {};
						this.timeline[ts][country_full_name] = country.timeline[ts];
					}
				}
				break;
*/
			case "my_merged":
				switch (data_name)
				{
					case "merged":
						var min_ts = 0;
						var require_cols = [];
						for (var row of raw_data)
						{
							var country = this.AddNewCountry(row["Country ISO"], row["Country"], row["Region ISO"], row["Region"], row["Population"]);

							// calculate min_ts
							if (!this.max_ts)
							{
								this.max_ts = Object.keys(row).reduce( (max, key) => { var dt = (new Date(key))-0; return (dt && dt > max ? dt : max); }, 0 );
								min_ts = (new Date(this.max_ts - (this.use_last_x_days*this.ms_in_day)))-this.ms_in_day;	// minus 1 day for better calculate first day changes
							}

							// collect require_cols to minimize date recognitions
							if (!require_cols.length)
							{
								var ts, keys = Object.keys(row).reverse();
								for (var k of keys)
								{
									if (!isNaN(k.substr(0, 1)))
									{
										if ((ts=(new Date(k))-0) >= min_ts)
											require_cols.unshift({ name:k, ts:ts });	// put in correct order
										else
											break;	// original list is sorted => if date less than required -> stop calculate others
									}
								}
							}

							// collect required data
							var prev_crd = [0, 0, 0, 0, 0];
							for (var key of require_cols)
							{
								var ts = key.ts;
								if (!country.timeline[ts])
									country.timeline[ts] = {};

//								if (data_name == "merged")
//								{
									// my format
									var crd = row[key.name].split("/");
									if (crd.length > 4)
									{
										// inherit `vaccined` from previous day if current is empty
										if (crd[0]-0 == 0)
											crd[0] = prev_crd[0];

										country.timeline[ts]["vaccined"]	= crd[0]-0;
										country.timeline[ts]["tested"]		= crd[1]-0;
										country.timeline[ts]["confirmed"]	= crd[2]-0;
										country.timeline[ts]["recovered"]	= crd[3]-0;
										country.timeline[ts]["deaths"]		= crd[4]-0;
									}
									// back compatibility
									else if (crd.length > 3)
									{
										country.timeline[ts]["tested"]		= crd[0]-0;
										country.timeline[ts]["confirmed"]	= crd[1]-0;
										country.timeline[ts]["recovered"]	= crd[2]-0;
										country.timeline[ts]["deaths"]		= crd[3]-0;
									}
									else
									{
										country.timeline[ts]["confirmed"]	= crd[0]-0;
										country.timeline[ts]["recovered"]	= crd[1]-0;
										country.timeline[ts]["deaths"]		= crd[2]-0;
									}

									prev_crd = crd;
//								}
//								else
//									country.timeline[ts][data_name] = row[key.name]-0;

								if (!this.timeline[ts])
									this.timeline[ts] = {};
								this.timeline[ts][ country.full_name ] = country.timeline[ts];
							}
						}
						break;

					case "merged_months":
						var min_ts = 0;
						var require_cols = [];
						for (var row of raw_data)
						{
							var country = this.AddNewCountry(row["Country ISO"], row["Country"], row["Region ISO"], row["Region"], row["Population"]);
							// calculate min_ts
							if (!this.max_month_ts)
							{
								this.max_month_ts = Object.keys(row).reduce( (max, key) => { var dt = (new Date(key))-0; return (dt && dt > max ? dt : max); }, 0 );
								min_ts = (new Date(this.max_month_ts - 15*31*this.ms_in_day));	// 15 months (year + few months)
							}

							// collect require_cols to minimize date recognitions
							if (!require_cols.length)
							{
								var ts, keys = Object.keys(row).reverse();
								for (var k of keys)
								{
									if (!isNaN(k.substr(0, 1)))
									{
										if ((ts=(new Date(k))-0) >= min_ts)
											require_cols.unshift({ name:k, ts:ts });	// put in correct order
										else
											break;	// original list is sorted => if date less than required -> stop calculate others
									}
								}
							}

							// collect required data
							var prev_crd = [0, 0, 0, 0, 0];
							for (var key of require_cols)
							{
								var ts = key.ts;
								if (!country.months_timeline[ts])
									country.months_timeline[ts] = {};

								// my format
								var crd = row[key.name].split("/");
								if (crd.length > 4)
								{
									// inherit `vaccined` from previous day if current is empty
									if (crd[0]-0 == 0)
										crd[0] = prev_crd[0];

									country.months_timeline[ts]["vaccined"]		= crd[0]-0;
									country.months_timeline[ts]["tested"]		= crd[1]-0;
									country.months_timeline[ts]["confirmed"]	= crd[2]-0;
									country.months_timeline[ts]["recovered"]	= crd[3]-0;
									country.months_timeline[ts]["deaths"]		= crd[4]-0;
								}
								// back compatibility
								else if (crd.length > 3)
								{
									country.months_timeline[ts]["tested"]		= crd[0]-0;
									country.months_timeline[ts]["confirmed"]	= crd[1]-0;
									country.months_timeline[ts]["recovered"]	= crd[2]-0;
									country.months_timeline[ts]["deaths"]		= crd[3]-0;
								}
								else
								{
									country.months_timeline[ts]["confirmed"]	= crd[0]-0;
									country.months_timeline[ts]["recovered"]	= crd[1]-0;
									country.months_timeline[ts]["deaths"]		= crd[2]-0;
								}

								prev_crd = crd;

								if (!this.months_timeline[ts])
									this.months_timeline[ts] = {};
								this.months_timeline[ts][ country.full_name ] = country.months_timeline[ts];
							}
						}
						break;

					case "country_borders":
						for (row of raw_data)
						{
							if (row["country_border_code"])
							{
								if (!this.COUNTRY_BORDERS[ row["country_code"] ])
									this.COUNTRY_BORDERS[ row["country_code"] ] = [];
								this.COUNTRY_BORDERS[ row["country_code"] ].push( row["country_border_code"] );
							}
						}
						break;

					case "country_names":
					case "region_names":
						for (row of raw_data)
							this.CODE_COUNTRY[ row["iso"] ] = row["name"];
						break;
				}
				break;
		}
	};

	ApplyCountrySumGroups()
	{
		// group parts of country
		var grouped_countries = this.countries.reduce(
			function (groups, country)
			{
				if (country.region)
				{
					var country_name = country.name;

					// get or create group-country
					var new_country = groups[ country_name ];
					if (!new_country)
					{
						new_country = Object.assign({}, country);
						new_country.timeline = {};
						new_country.code = country["code"];
						new_country.region = "∑";
						new_country.region_code = null;
						new_country.full_name = new_country.name + " / " + new_country.region;
						new_country.regions = [];
						groups[ country_name ] = new_country;
					}

					// fill it's timeline by region's data
					var new_country_timeline = new_country.timeline;
					for (var dt in country.timeline)
					{
						var country_timeline_day = country.timeline[dt];
						for (var key in country_timeline_day)
						{
							if (!new_country_timeline[dt])
								new_country_timeline[dt] = {};
							new_country_timeline[dt][key] = new_country_timeline[dt][key] || 0;
							new_country_timeline[dt][key] += country_timeline_day[key] || 0;
						}
					}

					// collect regions and population
					new_country.regions.push( country );
					new_country.population += country.population;
				}
				return groups;
			},
			{}
		);

		// apply new groups
		for (var new_group_name in grouped_countries)
		{
			var new_group = grouped_countries[new_group_name];

			// add to countries list
			this.countries.push( new_group );

			var country_name = new_group.full_name.split(" / ")[0];
			var separate_country = this.GetCountryByFullName(country_name);

			// fill tested values from country (currently we don't have stat by regions)
			if (separate_country)
			{
				for (var ts in new_group.timeline)
					if (separate_country.timeline[ts])
						new_group.timeline[ts].tested = separate_country.timeline[ts].tested;
			}

			// replace in timeline
			for (var ts in new_group.timeline)
			{
				// remove regions from global timeline
				for (var region of new_group.regions)
					delete this.timeline[ts][ region.full_name ];

				// add sum group, if we hasn't separate country
				if (!separate_country)
					this.timeline[ts][ new_group.full_name ] = new_group.timeline[ts];
			}

			// make copy as separate country to possibility find it by country name
			if (!separate_country)
			{
				separate_country = Object.assign({}, new_group);
				separate_country.full_name = country_name;
//					separate_country.population = ;		// TODO: fix when population will be in separate file
				separate_country.region = null;
				delete separate_country.regions;

				// add separate country
				this.countries.push( separate_country );

				// replace in timeline
				for (var ts in separate_country.timeline)
					this.timeline[ts][ separate_country.full_name ] = separate_country.timeline[ts];
			}
		}
	}

	GetCountryByFullName(name)
	{
		return this.countries.find(country => country.full_name == name);
	}

	GetPopulationByCountryName(name)
	{
		return (this.GetCountryByFullName(name) || {}).population;
	}

	GetCodeByCountryName(name)
	{
//		return (this.GetCountryByFullName(name) || {}).code;
		return this.country2code[name];
	}

	GetCountryNameByCode(code)
	{
		return this.code2country[code];
	}

	GetLocalizedName(orig_name)
	{
		var country_els = orig_name.split(" / ");
		if (country_els.length == 1)
		{
			var country_code = this.country2code[ country_els[0] ];
			var localized_name = this.CODE_COUNTRY[ country_code ] || this.CODE_COUNTRY[ country_els[0] ] || country_els[0];
		}
		else
		{
			var region_code = this.region2code[ orig_name ];
			var localized_name = this.CODE_COUNTRY[ region_code ] || this.CODE_COUNTRY[ country_els[1] ] || country_els[1];
		}
		return localized_name;
	}

	GetSortedLocalizedCountryList(with_groups)
	{
		var list = [];
		for (var idx in this.countries)
		{
			var country = this.countries[idx];
			var localized_full_name = this.CODE_COUNTRY[ country.code ] || this.CODE_COUNTRY[ country.name ] || country.name;
			if (country.region)
			{
				var region_name = country.region;
				if (country.region_code)
					region_name = this.CODE_COUNTRY[ country.region_code ] || this.CODE_COUNTRY[ country.region ] || country.region;
				localized_full_name += " / " + region_name;
			}
			list.push( { id:country.full_name, value:localized_full_name } );
		}

		var final_list = list.sort( (s1, s2) => s1.value.localeCompare(s2.value) );

		if (with_groups)
		{
			final_list.unshift({ id:"-", value:"-" });
			var self = this;
			Object.keys(this.TOP_REGIONS).reverse().forEach(function(gname)
			{
				var group = { id:gname, value:self.CODE_COUNTRY[gname] };
				final_list.unshift(group);
			});
		}

		return final_list;
	}

	GetTimelineWithoutCountryDuplicates()
	{
		// remove duplicates (Russia and Russia / ∑)
		var countries_timeline = {};
		for (var ts in this.timeline)
		{
			var orig_day_countries = this.timeline[ts];
			var day_countries = Object.assign({}, orig_day_countries);
			for (var country_name in orig_day_countries)
			{
				if (country_name.substr(-1) == "∑")
				{
					var name_els = country_name.split(" / ");
					if (day_countries[ name_els[0] ])
						delete day_countries[country_name];
				}
			}

			countries_timeline[ts] = day_countries;
		}
		return countries_timeline;
	}

	GetTimelineByCountryName(name)
	{
		if (name.substr)
			return this.GetCountryByFullName(name).timeline;

		// by list of countries
		var names_list = name;
		var grouped_timeline = {};
		var countries = this.countries.filter( d => names_list.indexOf(d.full_name) >= 0 );
		for (var country of countries)
		{
			for (var ts in country.timeline)
			{
				var grouped_day = grouped_timeline[ts];
				if (!grouped_day)
					grouped_day = grouped_timeline[ts] = {};

				// if countries list has only 1 country, but this country has regions => collect them
				if (countries.length === 1 && country.regions && (country.regions.length > 0))
				{
					for (var region of country.regions)
						grouped_day[ region.full_name ] = region.timeline[ts];
				}
				else
					grouped_day[ country.full_name ] = country.timeline[ts];
			}
		}
		return grouped_timeline;
	}

	GetMonthsTimelineByCountryName(name)
	{
		if (name.substr)
			return this.GetCountryByFullName(name).months_timeline;

		// by list of countries
		var names_list = name;
		var grouped_timeline = {};
		var countries = this.countries.filter( d => names_list.indexOf(d.full_name) >= 0 );
		for (var country of countries)
		{
			for (var ts in country.months_timeline)
			{
				var grouped_day = grouped_timeline[ts];
				if (!grouped_day)
					grouped_day = grouped_timeline[ts] = {};

				// if countries list has only 1 country, but this country has regions => collect them
				if (countries.length === 1 && country.regions && (country.regions.length > 0))
				{
					for (var region of country.regions)
						grouped_day[ region.full_name ] = region.months_timeline[ts];
				}
				else
					grouped_day[ country.full_name ] = country.months_timeline[ts];
			}
		}
		return grouped_timeline;
	}

	GetLimitedDaysByTimeline(timeline, min_date)
	{
		min_date -= 0;
		var ms, days = [];
		for (var ts in timeline)
		{
			ms = ts-0;
			if (ms >= min_date)
			{
				var day = Object.assign({}, timeline[ts]);
				day.date = new Date(ms);
				days.push( day );
			}
		}
		return days;
	}

	GetLimitedDaysByCountryName(country_name, min_date)
	{
		var timeline = this.GetTimelineByCountryName(country_name);
		return this.GetLimitedDaysByTimeline(timeline, min_date);
	}

	GetCountryWithLargestValueOf(value_type)
	{
		var max_ts = Object.keys(this.timeline).reduce( (max_ts, ts) => (ts-0 > max_ts ? ts-0 : max_ts), 0 );
		var countries = this.timeline[max_ts];
		return Object.keys(countries).reduce( (result, country) => (!result || countries[country][value_type] > result.values[value_type] ? { name:country, values:countries[country] } : result), null );
	}

	GetCountryNeighbours(country_name)
	{
		return this.COUNTRY_BORDERS[country_name];
	}
}
