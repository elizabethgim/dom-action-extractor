# Employment in agriculture vs. urban population - Data package

This data package contains the data that powers the chart ["Employment in agriculture vs. urban population"](https://ourworldindata.org/grapher/employment-in-agri-vs-urban-pop?v=1&csvType=full&useColumnShortNames=false) on the Our World in Data website.

## CSV Structure

The high level structure of the CSV file is that each row is an observation for an entity (usually a country or region) and a timepoint (usually a year).

The first two columns in the CSV file are "Entity" and "Code". "Entity" is the name of the entity (e.g. "United States"). "Code" is the OWID internal entity code that we use if the entity is a country or region. For most countries, this is the same as the [iso alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3) code of the entity (e.g. "USA") - for non-standard countries like historical countries these are custom codes.

The third column is either "Year" or "Day". If the data is annual, this is "Year" and contains only the year as an integer. If the column is "Day", the column contains a date string in the form "YYYY-MM-DD".

The remaining columns are the data columns, each of which is a time series. If the CSV data is downloaded using the "full data" option, then each column corresponds to one time series below. If the CSV data is downloaded using the "only selected data visible in the chart" option then the data columns are transformed depending on the chart type and thus the association with the time series might not be as straightforward.


## Metadata.json structure

The .metadata.json file contains metadata about the data package. The "charts" key contains information to recreate the chart, like the title, subtitle etc.. The "columns" key contains information about each of the columns in the csv, like the unit, timespan covered, citation for the data etc..

## About the data

Our World in Data is almost never the original producer of the data - almost all of the data we use has been compiled by others. If you want to re-use data, it is your responsibility to ensure that you adhere to the sources' license and to credit them correctly. Please note that a single time series may have more than one source - e.g. when we stich together data from different time periods by different producers or when we calculate per capita metrics using population data from a second source.

### How we process data at Our World In Data
All data and visualizations on Our World in Data rely on data sourced from one or several original data providers. Preparing this original data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, as well as adding or adapting metadata such as the name or the description given to an indicator.
[Read about our data pipeline](https://docs.owid.io/projects/etl/)

## Detailed information about each time series


## Share of people employed in agricultural sector
The share of people employed in agriculture includes working-age people with a job in farming, forestry, fishing, and related activities, including those temporarily absent.
Last updated: September 8, 2025  
Next update: September 2026  
Date range: 1991–2023  
Unit: %  


### How to cite this data

#### In-line citation
If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:  
ILO via World Bank – processed by Our World in Data

#### Full citation
ILO via World Bank – processed by Our World in Data. “Share of people employed in agricultural sector” [dataset]. World Bank Gender Statistics, “World Bank Gender Statistics” [original data].
Source: ILO via World Bank – processed by Our World In Data

### What you should know about this data
* This measures the percentage of all workers who are employed in agriculture.
* Agriculture includes farming, forestry, fishing, and related activities.
* People are counted even if they are temporarily absent from work due to sickness, leave, or seasonal factors.

### How is this data described by its producer - ILO via World Bank?
**Definition:** Employment is defined as persons of working age who were engaged in any activity to produce goods or provide services for pay or profit, whether at work during the reference period or not at work due to temporary absence from a job, or to working-time arrangement. The agriculture sector consists of activities in agriculture, hunting, forestry and fishing, in accordance with division 1 (ISIC 2) or categories A-B (ISIC 3) or category A (ISIC 4).

**Aggregation method:** Weighted average

**Limitations and exceptions:** There are many differences in how countries define and measure employment status, particularly members of the armed forces, self-employed workers, and unpaid family workers. Where members of the armed forces are included, they are allocated to the service sector, causing that sector to be somewhat overstated relative to the service sector in economies where they are excluded. Where data are obtained from establishment surveys, data cover only employees; thus self-employed and unpaid family workers are excluded. In such cases the employment share of the agricultural sector is severely underreported. Caution should be also used where the data refer only to urban areas, which record little or no agricultural work. Moreover, the age group and area covered could differ by country or change over time within a country. For detailed information, consult the original source.

Countries also take different approaches to the treatment of unemployed people. In most countries unemployed people with previous job experience are classified according to their last job. But in some countries the unemployed and people seeking their first job are not classifiable by economic activity. Because of these differences, the size and distribution of employment by economic activity may not be fully comparable across countries.

The ILO reports data by major divisions of the ISIC revision 2, revision 3, or revision 4. Broad classification such as employment by agriculture, industry, and services may obscure fundamental shifts within countries' industrial patterns. A slight majority of countries report economic activity according to the ISIC revision 3 instead of revision 2 or revision 4. The use of one classification or the other should not have a significant impact on the information for the employment of the three broad sectorsdata.

**Notes from original source:** Given the exceptional situation, including the scarcity of relevant data, the  ILO modeled estimates and projections from 2020 onwards are subject to substantial uncertainty.

### Source

#### World Bank Gender Statistics
Retrieved on: 2025-09-08  
Retrieved from: https://genderdata.worldbank.org/en/home  


## Share of population living in urban areas
Last updated: February 27, 2026  
Next update: February 2027  
Date range: 1960–2024  
Unit: % of total  


### How to cite this data

#### In-line citation
If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:  
World Urbanization Prospects - UN Population Division, via World Bank (2026) – processed by Our World in Data

#### Full citation
World Urbanization Prospects - UN Population Division, via World Bank (2026) – processed by Our World in Data. “Share of population living in urban areas” [dataset]. World Urbanization Prospects - UN Population Division, via World Bank, “World Development Indicators 125” [original data].
Source: World Urbanization Prospects - UN Population Division, via World Bank (2026) – processed by Our World In Data

### How is this data described by its producer - World Urbanization Prospects - UN Population Division, via World Bank (2026)?
Urban population refers to people living in urban areas as defined by national statistical offices. The data are collected and smoothed by United Nations Population Division.

### Limitations and exceptions:
Aggregation of urban and rural population may not add up to total population because of different country coverage. There is no consistent and universally accepted standard for distinguishing urban from rural areas, in part because of the wide variety of situations across countries.

Most countries use an urban classification related to the size or characteristics of settlements. Some define urban areas based on the presence of certain infrastructure and services. And other countries designate urban areas based on administrative arrangements. Because of national differences in the characteristics that distinguish urban from rural areas, the distinction between urban and rural population is not amenable to a single definition that would be applicable to all countries.

Estimates of the world's urban population would change significantly if China, India, and a few other populous nations were to change their definition of urban centers.

Because the estimates of city and metropolitan area are based on national definitions of what constitutes a city or metropolitan area, cross-country comparisons should be made with caution.

### Statistical concept and methodology:
Urban population refers to people living in urban areas as defined by national statistical offices. The indicator is calculated using World Bank population estimates and urban ratios from the United Nations World Urbanization Prospects.

Percentages urban are the numbers of persons residing in an area defined as ''urban'' per 100 total population. Particular caution should be used in interpreting the figures for percentage urban for different countries.

Countries differ in the way they classify population as "urban" or "rural." The population of a city or metropolitan area depends on the boundaries chosen.

### Source

#### World Urbanization Prospects - UN Population Division, via World Bank – World Development Indicators
Retrieved on: 2026-02-27  
Retrieved from: https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS  


## World region according to OWID
Regions defined by Our World in Data, which are used in OWID charts and maps.
Last updated: January 1, 2023  
Date range: 2023–2023  


### How to cite this data

#### In-line citation
If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:  
Our World in Data – processed by Our World in Data

#### Full citation
Our World in Data – processed by Our World in Data. “World region according to OWID” [dataset]. Our World in Data, “Regions” [original data].
Source: Our World in Data

### Source

#### Our World in Data – Regions


    