import * as d3 from "d3";


// Specify the chart’s dimensions.
const width = 928;
const height = 500;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 30;
const marginLeft = 30;

// contract_transaction_unique_key,contract_award_unique_key,award_id_piid,modification_number,transaction_number,parent_award_agency_id,parent_award_agency_name,parent_award_id_piid,parent_award_modification_number,federal_action_obligation,total_dollars_obligated,total_outlayed_amount_for_overall_award,base_and_exercised_options_value,current_total_value_of_award,base_and_all_options_value,potential_total_value_of_award,disaster_emergency_fund_codes_for_overall_award,outlayed_amount_from_COVID-19_supplementals_for_overall_award,obligated_amount_from_COVID-19_supplementals_for_overall_award,outlayed_amount_from_IIJA_supplemental_for_overall_award,obligated_amount_from_IIJA_supplemental_for_overall_award,action_date,action_date_fiscal_year,period_of_performance_start_date,period_of_performance_current_end_date,period_of_performance_potential_end_date,ordering_period_end_date,solicitation_date,awarding_agency_code,awarding_agency_name,awarding_sub_agency_code,awarding_sub_agency_name,awarding_office_code,awarding_office_name,funding_agency_code,funding_agency_name,funding_sub_agency_code,funding_sub_agency_name,funding_office_code,funding_office_name,treasury_accounts_funding_this_award,federal_accounts_funding_this_award,object_classes_funding_this_award,program_activities_funding_this_award,foreign_funding,foreign_funding_description,sam_exception,sam_exception_description,recipient_uei,recipient_duns,recipient_name,recipient_name_raw,recipient_doing_business_as_name,cage_code,recipient_parent_uei,recipient_parent_duns,recipient_parent_name,recipient_parent_name_raw,recipient_country_code,recipient_country_name,recipient_address_line_1,recipient_address_line_2,recipient_city_name,prime_award_transaction_recipient_county_fips_code,recipient_county_name,prime_award_transaction_recipient_state_fips_code,recipient_state_code,recipient_state_name,recipient_zip_4_code,prime_award_transaction_recipient_cd_original,prime_award_transaction_recipient_cd_current,recipient_phone_number,recipient_fax_number,primary_place_of_performance_country_code,primary_place_of_performance_country_name,primary_place_of_performance_city_name,prime_award_transaction_place_of_performance_county_fips_code,primary_place_of_performance_county_name,prime_award_transaction_place_of_performance_state_fips_code,primary_place_of_performance_state_code,primary_place_of_performance_state_name,primary_place_of_performance_zip_4,prime_award_transaction_place_of_performance_cd_original,prime_award_transaction_place_of_performance_cd_current,award_or_idv_flag,award_type_code,award_type,idv_type_code,idv_type,multiple_or_single_award_idv_code,multiple_or_single_award_idv,type_of_idc_code,type_of_idc,type_of_contract_pricing_code,type_of_contract_pricing,transaction_description,prime_award_base_transaction_description,action_type_code,action_type,solicitation_identifier,number_of_actions,inherently_governmental_functions,inherently_governmental_functions_description,product_or_service_code,product_or_service_code_description,contract_bundling_code,contract_bundling,dod_claimant_program_code,dod_claimant_program_description,naics_code,naics_description,recovered_materials_sustainability_code,recovered_materials_sustainability,domestic_or_foreign_entity_code,domestic_or_foreign_entity,dod_acquisition_program_code,dod_acquisition_program_description,information_technology_commercial_item_category_code,information_technology_commercial_item_category,epa_designated_product_code,epa_designated_product,country_of_product_or_service_origin_code,country_of_product_or_service_origin,place_of_manufacture_code,place_of_manufacture,subcontracting_plan_code,subcontracting_plan,extent_competed_code,extent_competed,solicitation_procedures_code,solicitation_procedures,type_of_set_aside_code,type_of_set_aside,evaluated_preference_code,evaluated_preference,research_code,research,fair_opportunity_limited_sources_code,fair_opportunity_limited_sources,other_than_full_and_open_competition_code,other_than_full_and_open_competition,number_of_offers_received,commercial_item_acquisition_procedures_code,commercial_item_acquisition_procedures,small_business_competitiveness_demonstration_program,simplified_procedures_for_certain_commercial_items_code,simplified_procedures_for_certain_commercial_items,a76_fair_act_action_code,a76_fair_act_action,fed_biz_opps_code,fed_biz_opps,local_area_set_aside_code,local_area_set_aside,price_evaluation_adjustment_preference_percent_difference,clinger_cohen_act_planning_code,clinger_cohen_act_planning,materials_supplies_articles_equipment_code,materials_supplies_articles_equipment,labor_standards_code,labor_standards,construction_wage_rate_requirements_code,construction_wage_rate_requirements,interagency_contracting_authority_code,interagency_contracting_authority,other_statutory_authority,program_acronym,parent_award_type_code,parent_award_type,parent_award_single_or_multiple_code,parent_award_single_or_multiple,major_program,national_interest_action_code,national_interest_action,cost_or_pricing_data_code,cost_or_pricing_data,cost_accounting_standards_clause_code,cost_accounting_standards_clause,government_furnished_property_code,government_furnished_property,sea_transportation_code,sea_transportation,undefinitized_action_code,undefinitized_action,consolidated_contract_code,consolidated_contract,performance_based_service_acquisition_code,performance_based_service_acquisition,multi_year_contract_code,multi_year_contract,contract_financing_code,contract_financing,purchase_card_as_payment_method_code,purchase_card_as_payment_method,contingency_humanitarian_or_peacekeeping_operation_code,contingency_humanitarian_or_peacekeeping_operation,alaskan_native_corporation_owned_firm,american_indian_owned_business,indian_tribe_federally_recognized,native_hawaiian_organization_owned_firm,tribally_owned_firm,veteran_owned_business,service_disabled_veteran_owned_business,woman_owned_business,women_owned_small_business,economically_disadvantaged_women_owned_small_business,joint_venture_women_owned_small_business,joint_venture_economic_disadvantaged_women_owned_small_bus,minority_owned_business,subcontinent_asian_asian_indian_american_owned_business,asian_pacific_american_owned_business,black_american_owned_business,hispanic_american_owned_business,native_american_owned_business,other_minority_owned_business,contracting_officers_determination_of_business_size,contracting_officers_determination_of_business_size_code,emerging_small_business,community_developed_corporation_owned_firm,labor_surplus_area_firm,us_federal_government,federally_funded_research_and_development_corp,federal_agency,us_state_government,us_local_government,city_local_government,county_local_government,inter_municipal_local_government,local_government_owned,municipality_local_government,school_district_local_government,township_local_government,us_tribal_government,foreign_government,organizational_type,corporate_entity_not_tax_exempt,corporate_entity_tax_exempt,partnership_or_limited_liability_partnership,sole_proprietorship,small_agricultural_cooperative,international_organization,us_government_entity,community_development_corporation,domestic_shelter,educational_institution,foundation,hospital_flag,manufacturer_of_goods,veterinary_hospital,hispanic_servicing_institution,receives_contracts,receives_financial_assistance,receives_contracts_and_financial_assistance,airport_authority,council_of_governments,housing_authorities_public_tribal,interstate_entity,planning_commission,port_authority,transit_authority,subchapter_scorporation,limited_liability_corporation,foreign_owned,for_profit_organization,nonprofit_organization,other_not_for_profit_organization,the_ability_one_program,private_university_or_college,state_controlled_institution_of_higher_learning,1862_land_grant_college,1890_land_grant_college,1994_land_grant_college,minority_institution,historically_black_college,tribal_college,alaskan_native_servicing_institution,native_hawaiian_servicing_institution,school_of_forestry,veterinary_college,dot_certified_disadvantage,self_certified_small_disadvantaged_business,small_disadvantaged_business,c8a_program_participant,historically_underutilized_business_zone_hubzone_firm,sba_certified_8a_joint_venture,highly_compensated_officer_1_name,highly_compensated_officer_1_amount,highly_compensated_officer_2_name,highly_compensated_officer_2_amount,highly_compensated_officer_3_name,highly_compensated_officer_3_amount,highly_compensated_officer_4_name,highly_compensated_officer_4_amount,highly_compensated_officer_5_name,highly_compensated_officer_5_amount,usaspending_permalink,initial_report_date,last_modified_date
// FY2025P01-P12_All_FA_AccountBalances_2026-02-08_H07M13S37_1
// parent_award_agency_name
// 
// FY2026_All_Contracts_Full_20260107_1.csv
const rows = await d3.csv("/FY2025P01-P12_All_FA_AccountBalances_2026-02-06_H18M02S36_1.csv", d => ({
  ...d,
  federal_action_obligation: +String(d.federal_action_obligation ?? 0).replace(/,/g, "") || 0,
  total_dollars_obligated: +String(d.total_dollars_obligated ?? 0).replace(/,/g, "") || 0
}));

// console.log("columns:", Object.keys(rows[0] ?? {}));
// console.log("sample federal_action_obligation:", rows[0]?.federal_action_obligation);
// console.log(
//   "nonzero count:",
//   rows.filter(d => d.federal_action_obligation !== 0).length,
//   "sum:",
//   d3.sum(rows, d => d.federal_action_obligation)
// );


// const VALUE_COL = "federal_action_obligation"; // or "total_dollars_obligated"

// const L1 = "awarding_agency_name";
// const L2 = "awarding_sub_agency_name";
// const L3 = "awarding_office_name";
// const NA = "(Unknown)";

// Outlay of US goverments based on budget function
const L1 = "budget_function";
const L2 = "budget_subfunction";
const L3 = "owning_agency_name";
const L4 = "obligations_incurred";

const VALUE_COL = "gross_outlay_amount";

function buildTree(rows) {
  const rolled = d3.rollup(
    rows,
    v => d3.sum(v, d => +d[VALUE_COL] || 0),
    d => (d[L1] ?? null) || null,
    d => (d[L2] ?? null) || null,
    d => (d[L3] ?? null) || null,
    d => (d[L4] ?? null) || null,
  );

  function mapToChildren(map) {
    const children = [];
    for (const [k, v] of map) {
      if (v instanceof Map) {
        children.push({ name: k, children: mapToChildren(v) });
      } else {
        children.push({ name: k, value: v });
      }
    }
    return children;
  }

  return { name: "root", children: mapToChildren(rolled) };
}

const data = buildTree(rows);

export function renderChart(container: HTMLElement){
  const width = 928;
  const height = width;
  const radius = width / 6;

  // Create the color scale.
  const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

  // Compute the layout.
  const hierarchy = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);

  const root = d3.partition()
      .size([2 * Math.PI, hierarchy.height + 1])
    (hierarchy);

  root.each(d => d.current = d);

  console.log("root value:", root.value);
    console.log("any NaN in nodes?", root.descendants().some(n => !Number.isFinite(n.value)));

  // Create the arc generator.
  const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1))

  // Create the SVG container.
  const svg = d3.select(container).append("svg")
      .attr("viewBox", [-width / 2, -height / 2, width, width])
      .style("font", "10px sans-serif");

  // Append the arcs.
  const path = svg.append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
      .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
      .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
      .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
      .attr("d", d => arc(d.current));

  // Make them clickable if they have children.
  path.filter(d => d.children)
      .style("cursor", "pointer")
      .on("click", clicked);

  const format = d3.format(",d");
  path.append("title")
      .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

  const label = svg.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
    .selectAll("text")
    .data(root.descendants().slice(1))
    .join("text")
      .attr("dy", "0.35em")
      .attr("fill-opacity", d => +labelVisible(d.current))
      .attr("transform", d => labelTransform(d.current))
      .text(d => d.data.name);

  const parent = svg.append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", clicked);

  // Handle zoom on click.
  function clicked(event, p) {
    parent.datum(p.parent || root);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });

    const t = svg.transition().duration(event.altKey ? 7500 : 750);

    // Transition the data on all arcs, even the ones that aren’t visible,
    // so that if this transition is interrupted, entering arcs will start
    // the next transition from the desired position.
    path.transition(t)
        .tween("data", d => {
          const i = d3.interpolate(d.current, d.target);
          return t => d.current = i(t);
        })
      .filter(function(d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
        .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none") 

        .attrTween("d", d => () => arc(d.current));

    label.filter(function(d) {
        return +this.getAttribute("fill-opacity") || labelVisible(d.target);
      }).transition(t)
        .attr("fill-opacity", d => +labelVisible(d.target))
        .attrTween("transform", d => () => labelTransform(d.current));
  }
  
  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }

  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
}