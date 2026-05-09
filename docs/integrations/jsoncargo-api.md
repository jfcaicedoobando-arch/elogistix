# Content from https://jsoncargo.com/documentation-api/

#### Documentation

- [Shipping Line Compatibility](https://jsoncargo.com/documentation-api/#shipping-line-compatibility)

- [API Usage Explanation](https://jsoncargo.com/documentation-api/#api-usage-explanation)

- [Understanding Third-Party Container Prefixes](https://jsoncargo.com/documentation-api/#third-party-prefix)

- [User Errors](https://jsoncargo.com/documentation-api/#elementor-toc__heading-anchor-3)

- [Endpoint 1: Get Container Details](https://jsoncargo.com/documentation-api/#get-container-details)

- [Endpoint 2: Get Container Numbers From Bill of Lading](https://jsoncargo.com/documentation-api/#bill-of-lading)

- [Endpoint 3: Get Basic Live Vessel Tracking Details](https://jsoncargo.com/documentation-api/#get-vessel-basic)

- [Endpoint 4: Get Pro Live Vessel Tracking Details](https://jsoncargo.com/documentation-api/#get-pro-vessel-details)

- [Endpoint 5: Get Bulk Live Vessel Tracking Details](https://jsoncargo.com/documentation-api/#get-bulk-vessel-details)

- [Endpoint 6: Vessel Finder API](https://jsoncargo.com/documentation-api/#vessel-finder-api)

- [Endpoint 7: Vessel Specs Details API](https://jsoncargo.com/documentation-api/#vessel-specs-api)

- [Endpoint 8: Port Finder](https://jsoncargo.com/documentation-api/#port-finder-api)

- [Endpoint 9: Terminal Finder API](https://jsoncargo.com/documentation-api/#terminal-finder-api)

- [Endpoint 10: Get API Key Usage Stats](https://jsoncargo.com/documentation-api/#get-api-key-usage-stats)

- [Programming Languages](https://jsoncargo.com/documentation-api/#programming-languages)

- [Need Help or Have Questions?](https://jsoncargo.com/documentation-api/#need-help)


# Getting Started

JSONCargo Container & Vessel Tracking API provides you with real-time Shipment & Vessel Tracking data from major shipping lines.

## Authentication

To access JSONCargo Container & Vessel Tracking API, you need to obtain an API key. You can get an API key by visiting our [pricing page](https://jsoncargo.com/pricing-plans/) and subscribing to one of our three API plans.  Once you have subscribed you will receive an email with your API key included.

### Shipping Line Compatibility

Container Tracking API is currently only compatible with:

| Shipping Line Name | Alternate Name | Internal ID Code |
| --- | --- | --- |
| A.P. Moller - Maersk | Maersk | 0010 |
| Hapag-Lloyd | Hapag-Lloyd | 0011 |
| Hyundai Merchant Marine | HMM | 0012 |
| Ocean Network Express | ONE | 0013 |
| Evergreen Marine Corp | Evergreen | 0014 |
| Mediterranean Shipping Company | MSC | 0015 |
| Compagnie Maritime d'Affrètement<br> Compagnie Générale Maritime | CMA CGM | 0016 |
| COSCO SHIPPING Lines Co | Cosco | 0017 |
| Zim Integrated Shipping Services | ZIM | 0018 |
| YangMing Marine Transport Corp | Yang Ming | 0019 |
| Pacific International Lines | PIL | 0020 |

Please note that this current list is not final. We are continuously working to expand our list of shipping line support, you can expect that more shipping lines will be added in the future to improve tracking coverage. If you have specific shipping lines you’d like to see in our Container Tracking API feel free to reach out to us, and we’ll consider them for future updates.

You can send your feedback at: [info@jsoncargo.com](mailto:info@jsoncargo.com)

### API Usage Explanation

Container and Vessel Tracking: Each API request to our system counts as one API call, regardless of whether it’s for a new or previously tracked container/vessel.

Tracking New Container: 1 API Call.

Tracking New Vessel: 1 API Call.

Tracking Previously Tracked Container: 1 API Call.

Tracking Previously Tracked Vessel: 1 API Call.

Example:

If you track 500 containers three times per week, this equals:

500 containers×3 times/week=1500 API calls/week

Monthly Usage: To estimate your monthly API calls, multiply the weekly calls by the number of weeks in a month (approximately 4.33):

1500 calls/week×4.33 weeks/month=6495 API calls/month

This calculation applies to Basic, Pro, and Bulk Vessel tracking requests as well. Make sure to account for any additional requests beyond your normal frequency.

What happens if I reach my monthly limit?

Upon reaching the max monthly calls you can choose to upgrade to a higher plan or to wait until the package renewal date.

You can always find your request statistics and current usage by calling Endpoint 9: Get API Key Usage Stats

### Understanding Third-Party Container Prefixes

In the container industry, a container prefix (the first four letters of a container number) typically identifies the shipping line that owns or operates the container. However, some prefixes are shared across multiple shipping lines due to leasing agreements, partnerships, etc.

For example, a container with the prefix **CCLU** might be used by COSCO, CMA CGM, or another carrier, making it impossible to determine the shipping line from the prefix alone. Third-party prefixes can be linked to multiple shipping lines. To ensure accurate tracking, users must specify the shipping line when making a request.

So if you are tracking a container with a shared prefix, you must include the shipping\_line query parameter in your request like this:

```javascript
GET http://api.jsoncargo.com/api/v1/containers/{tracking_number}?shipping_line={shipping_line_name}
```

Copy

If a container has a third-party prefix and no shipping line is specified, the request may return a 404 not found error or incorrect data, as the system cannot determine which shipping line to query.

### User Errors

If you are experiencing issues with your API requests, please check the following common user errors before reaching out to support:

- Incorrect Container Number - Make sure you typed your container number correctly, including the four-letter prefix (e.g. ABCD1234567).

- Incorrect Shipping Line Name - If you're tracking a third-party prefix, check that the shipping line name is spelled correctly.

- Missing, Invalid or Expired API Key - Verify that your API key is included in the request header and is valid.

- Rate Limit Exceeded - If you exceeded your monthly request limit, your queries may not return data. You can check your usage using our API Key Usage Stats Endpoint.

- Expired Subscription - Ensure that your subscription is active and that your payments are up to date.

If you’ve checked all the above and you are still experiencing issues, please contact us at [support@jsoncargo.com](mailto:support@jsoncargo.com)

### Endpoint 1: Get Container Details

Fetches details of a container using the tracking number.

```javascript
Authorizations: ApiKeyAuth
```

Copy

API Key: ApiKeyAuth

```javascript
GET http://api.jsoncargo.com/api/v1/containers/{tracking_number}?shipping_line={shipping_line_name}
```

Copy

Header Parameter Name:

```javascript
x-api-key
```

Copy

Path Parameters:

- tracking\_number: string

required

Query Parameters:

- shipping\_line: string

required if using a third-party prefix – The shipping line associated with the container

```javascript
GET http://api.jsoncargo.com/api/v1/containers/{tracking_number}?shipping_line={shipping_line_name}
```

Copy

- Each shipping line has a specific name that must be used in API calls. To ensure correct API calls, refer to the table below for the proper API Shipping Line Name to use:

| Request Parameter | Object |
| --- | --- |
| MAERSK | string |
| HAPAG\_LLOYD | string |
| HMM | string |
| ONE | string |
| EVERGREEN | string |
| MSC | string |
| CMA\_CGM | string |
| COSCO | string |
| ZIM | string |
| YANG\_MING | string |
| PIL | string |

If you are receiving a ‘Prefix Not Found’ error, please reach out to us at [support@jsoncargo.com](mailto:support@jsoncargo.com), it is possible that the container prefix is not yet in our database, and we can add it for you.

Responses

View response sample

200 Container details retrieved successfully

`Response Schema: application/json`

| Data | Object |
| --- | --- |
| container\_id | string |
| container\_type | string |
| container\_status | string |
| shipping\_line\_name | string |
| shipping\_line\_id | string |
| tare | float |
| shipped\_from | string |
| shipped\_from\_terminal | string |
| shipped\_to | string |
| shipped\_to\_terminal | string |
| atd\_origin | datetime |
| eta\_final\_destination | datetime |
| last\_location | string |
| last\_location\_terminal | string |
| next\_location | string |
| next\_location\_terminal | string |
| atd\_last\_location | datetime |
| eta\_next\_destination | datetime |
| timestamp\_of\_last\_location | datetime |
| last\_movement\_timestamp | datetime |
| loading\_port | string |
| discharging\_port | string |
| customs\_clearance | datetime |
| bill\_of\_lading | string |
| last\_vessel\_name | string |
| last\_voyage\_number | string |
| current\_vessel\_name | string |
| current\_voyage\_number | string |
| last\_updated | datetime |

404 Container not found

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

404 Prefix not found

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

429 Too many requests

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

500 Internal Server Error

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

Response sample:

```javascript
Content type
application/json
```

Copy

```javascript
{
  "data": {
    "container_id": "MEDU9091004",
    "container_type": "40' HIGH CUBE REEFER",
    "container_status": "Empty received at CY",
    "shipping_line_name": "Mediterranean Shipping Company",
    "shipping_line_id": "0015",
    "tare": 3900,
    "shipped_from": "GUAYAQUIL, EC",
    "shipped_from_terminal": "NAPORTEC TERMINAL - BANANAPUERTO ",
    "shipped_to": "TRIPOLI, LY",
    "shipped_to_terminal": "SPCO ( SOCIALIST PORTS CO UNDER MINISTRY OF TRANSPORT ) ",
    "atd_origin": "2024-07-09 00:00",
    "eta_final_destination": "2024-08-10 00:00",
    "last_location": "TRIPOLI, LY",
    "last_location_terminal": "SPCO ( SOCIALIST PORTS CO UNDER MINISTRY OF TRANSPORT ) ",
    "next_location": "TRIPOLI, LY - CY Depot",
    "next_location_terminal": "AL MOURSSALAT CONTAINER YARD",
    "atd_last_location": "2024-08-11 00:00",
    "eta_next_destination": "2024-08-20 00:00",
    "timestamp_of_last_location": "2024-08-13 00:00",
    "last_movement_timestamp": "2024-08-17 00:00",
    "loading_port": "GUAYAQUIL, EC",
    "discharging_port": "TRIPOLI, LY",
    "customs_clearance": "2024-08-14 00:00",
    "bill_of_lading": "MEDUGY914103",
    "last_vessel_name": "MSC LENA F",
    "last_voyage_number": "YF432A",
    "current_vessel_name": "MSC LENA F",
    "current_voyage_number": "YF432A",
    "last_updated": "2024-09-09 18:34"
  }
}
```

Copy

### Endpoint 2: Get Container Numbers From Bill of Lading

Fetches a list of container numbers associated with a specific Bill of Lading (BoL) number.

```javascript
Authorizations: ApiKeyAuth
```

Copy

```javascript
GET http://api.jsoncargo.com/api/v1/containers/bol/{bill_of_lading_number}?shipping_line={shipping_line_name}
```

Copy

API Key: ApiKeyAuth

Header Parameter Name:

```javascript
x-api-key
```

Copy

Path Parameters:

- bill\_of\_lading\_number: string

required

Query Parameters:

- shipping\_line: string

required

- Each shipping line has a specific name that must be used in API calls. To ensure correct API calls, refer to the table below for the proper API Shipping Line Name to use:

| Request Parameter | Object |
| --- | --- |
| MAERSK | string |
| HAPAG\_LLOYD | string |
| HMM | string |
| ONE | string |
| EVERGREEN | string |
| MSC | string |
| CMA\_CGM | string |
| COSCO | string |
| ZIM | string |
| YANG\_MING | string |
| PIL | string |

Responses

View response sample

200 Bill of lading details retrieved successfully

`Response Schema: application/json`

| Data | Object |
| --- | --- |
| bill\_of\_lading | string |
| shipping\_line\_name | string |
| shipping\_line\_id | string |
| associated\_containers | integer |
| associated\_container\_numbers | array of strings |
| last\_updated | string |

400 Invalid request

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

404 Container not found

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

429 Too many requests

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

500 Internal server error

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

Response sample:

```javascript
Content type
application/json
```

Copy

```javascript
{
    "data": {
        "bill_of_lading": "SZPE72846000",
        "shipping_line_name": "Hyundai Merchant Marine",
        "shipping_line_id": "0012",
        "associated_containers": 16,
        "associated_container_numbers": [\
            "CAIU9933760",\
            "CLKU5004260",\
            "GAOU6162340",\
            "HDMU6653051",\
            "HDMU6836237",\
            "HMMU6053862",\
            "HMMU6541677",\
            "HMMU6668297",\
            "KOCU4503822",\
            "KOCU4771471",\
            "KOCU4839231",\
            "KOCU4904240",\
            "KOCU5067657",\
            "KOCU5082841",\
            "ROEU8622402",\
            "TGBU6353192"\
        ],
        "last_updated": "2025-03-28 04:09"
    }
}
```

Copy

### Endpoint 3: Get Basic Live Vessel Tracking Details

Fetches basic details of a vessel using either UUID, [MMSI](https://www.fcc.gov/wireless/bureau-divisions/mobility-division/maritime-mobile/ship-radio-stations/maritime-mobile), or [IMO](https://www.imo.org/en/ourwork/msas/pages/imo-identification-number-scheme.aspx) as query parameters.

```javascript
Authorizations: ApiKeyAuth
```

Copy

```javascript
GET/vessel/api/v1/basic
http://api.jsoncargo.com/api/v1/vessel/basic
```

Copy

API Key: ApiKeyAuth

Header Parameter Name:

```javascript
x-api-key
```

Copy

Query Parameters:

| Data | Object |
| --- | --- |
| uuid | string |
| mmsi | string |
| imo | string |
| page | string |
| limit | string |

Responses

View response sample

200 Basic vessel details retrieved successfully

`Response Schema: application/json`

| Data | Object |
| --- | --- |
| uuid | string |
| name | string |
| mmsi | string |
| imo | string |
| eni | string |
| country\_iso | string |
| type | string |
| type\_specific | string |
| lat | number |
| lon | number |
| speed | number |
| course | number |
| heading | number |
| navigation\_status | string |
| destination | string |
| last\_position\_epoch | integer |
| last\_position\_UTC | string |
| eta\_epoch | integer |
| eta\_UTC | string |

400 Invalid request

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

404 Vessel not found

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

429 Too many requests

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

500 Internal server error

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

Response sample:

```javascript
Content type
application/json
```

Copy

```javascript
{
  "data": {
    "uuid": "b8625b67-7142-cfd1-7b85-595cebfe4191",
    "name": "MAERSK CHENNAI",
    "mmsi": "566093000",
    "imo": "9525338",
    "eni": null,
    "country_iso": "SG",
    "type": "Cargo - Hazard A (Major)",
    "type_specific": "Container Ship",
    "lat": 5.51935,
    "lon": 0.02906167,
    "speed": 0.1,
    "course": 256,
    "heading": 144,
    "navigation_status": null,
    "destination": "CGPNR>GHTEM",
    "last_position_epoch": 1721842560,
    "last_position_UTC": "2024-07-24T17:36:00Z",
    "eta_epoch": 1721633940,
    "eta_UTC": "2024-07-22T07:39:00Z"
  }
}
```

Copy

### Endpoint 4: Get Pro Live Vessel Tracking Details

Fetches pro details of a vessel using either UUID, MMSI, or IMO as query parameters.

```javascript
Authorizations: ApiKeyAuth
```

Copy

```javascript
GET/api/v1/vessel/pro
http://api.jsoncargo.com/api/v1/vessel/pro
```

Copy

API Key: ApiKeyAuth

Header Parameter Name:

```javascript
x-api-key
```

Copy

Query Parameters:

| Data | Object |
| --- | --- |
| uuid | string |
| mmsi | string |
| imo | string |
| page | string |
| limit | string |

Responses

View response sample

200 Pro vessel details retrieved successfully

`Response Schema: application/json`

| Data | Object |
| --- | --- |
| uuid | string |
| name | string |
| mmsi | string |
| imo | string |
| eni | string or None |
| country\_iso | string |
| type | string |
| type\_specific | string |
| lat | number |
| lon | number |
| speed | number |
| course | number |
| heading | number |
| current\_draught | number |
| navigation\_status | string or None |
| destination | string |
| dest\_port\_uuid | string |
| dest\_port | string |
| dest\_port\_unlocode | string |
| dep\_port\_uuid | string |
| dep\_port | string |
| dep\_port\_unlocode | string |
| last\_position\_epoch | integer |
| last\_position\_UTC | string |
| atd\_epoch | integer |
| atd\_UTC | string |
| eta\_epoch | integer |
| eta\_UTC | string |
| timezone\_offset\_sec | integer |
| timezone | string |

400 Invalid request

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

404 Vessel not found

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

429 Too many requests

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

500 Internal server error

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

Response sample:

```javascript
Content type
application/json
```

Copy

```javascript
{
  "data": {
    "uuid": "b8625b67-7142-cfd1-7b85-595cebfe4191",
    "name": "MAERSK CHENNAI",
    "mmsi": "566093000",
    "imo": "9525338",
    "eni": null,
    "country_iso": "SG",
    "type": "Cargo - Hazard A (Major)",
    "type_specific": "Container Ship",
    "lat": 5.519612,
    "lon": 0.02949333,
    "speed": 0.1,
    "course": 133,
    "heading": 161,
    "current_draught": 12.9,
    "navigation_status": null,
    "destination": "CGPNR>GHTEM",
    "dest_port_uuid": "4e16eec7-c821-423f-7a61-31ca9cdd4601",
    "dest_port": "TEMA",
    "dest_port_unlocode": "GHTEM",
    "dep_port_uuid": "11ccc7a1-cb91-bfd8-fefd-520b892be1da",
    "dep_port": "POINTE NOIRE",
    "dep_port_unlocode": "CGPNR",
    "last_position_epoch": 1721925300,
    "last_position_UTC": "2024-07-25T16:35:00Z",
    "atd_epoch": 1721391180,
    "atd_UTC": "2024-07-19T12:13:00Z",
    "eta_epoch": 1721633940,
    "eta_UTC": "2024-07-22T07:39:00Z",
    "timezone_offset_sec": 0,
    "timezone": "GMT"
  }
}
```

Copy

### Endpoint 5: Get Bulk Live Vessel Tracking Details

Fetches details of up to 100 vessels using their identifiers (UUID, MMSI, or IMO) as query parameters.

```javascript
Authorizations: ApiKeyAuth
```

Copy

```javascript
GET/api/v1/vessel/bulk
http://api.jsoncargo.com/v1/vessel/bulk
```

Copy

API Key: ApiKeyAuth

Header Parameter Name:

```javascript
x-api-key
```

Copy

Query Parameters:

| Data | Object |
| --- | --- |
| uuid | string |
| mmsi | string |
| imo | string |
| page | string |
| limit | string |

Responses

View response sample

200 Bulk vessel details retrieved successfully

`Response Schema: application/json`

| Data | Array of objects |
| --- | --- |
| uuid | string |
| name | string |
| mmsi | string |
| imo | string |
| eni | string or None |
| country\_iso | string |
| type | string |
| type\_specific | string |
| lat | number |
| lon | number |
| speed | number |
| course | number |
| heading | number |
| navigation\_status | string or None |
| destination | string |
| last\_position\_epoch | integer |
| last\_position\_UTC | string |
| eta\_epoch | integer or None |
| eta\_UTC | string or None |

400 Invalid request

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

404 Vessel not found

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

429 Too many requests

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

500 Internal server error

`Response Schema: application/json`

| Error | Object |
| --- | --- |
| title | string |

Response sample:

```javascript
Content type
application/json
```

Copy

```javascript
{
  "data": {
    "total": 2,
    "vessels": [\
      {\
        "uuid": "17959a4c-f5a9-ed71-1a42-5bfab00670ef",\
        "name": "GARGANO",\
        "mmsi": "235362000",\
        "imo": "9249403",\
        "eni": null,\
        "country_iso": "GB",\
        "type": "Other",\
        "type_specific": "Supply Vessel",\
        "lat": 54.105115,\
        "lon": 0.016225,\
        "speed": 4.4,\
        "course": 332.8,\
        "heading": 333,\
        "navigation_status": "Under way using engine",\
        "destination": "SUNDERLAND",\
        "last_position_epoch": 1638543058,\
        "last_position_UTC": "2021-12-03T14:50:58Z",\
        "eta_epoch": null,\
        "eta_UTC": null\
      },\
      {\
        "uuid": "b8625b67-7142-cfd1-7b85-595cebfe4191",\
        "name": "MAERSK CHENNAI",\
        "mmsi": "566093000",\
        "imo": "9525338",\
        "eni": null,\
        "country_iso": "SG",\
        "type": "Cargo - Hazard A (Major)",\
        "type_specific": "Container Ship",\
        "lat": -4.92493,\
        "lon": 11.52828,\
        "speed": 10.8,\
        "course": 204,\
        "heading": 201,\
        "navigation_status": null,\
        "destination": "CGPNR\u003eGHTMA",\
        "last_position_epoch": 1638335880,\
        "last_position_UTC": "2021-12-01T05:18:00Z",\
        "eta_epoch": null,\
        "eta_UTC": null\
  }\
}\
```\
\
Copy\
\
### Endpoint 6: Vessel Finder API\
\
Fetches static ship data using various query parameters.\
\
```javascript\
Authorizations: ApiKeyAuth\
```\
\
Copy\
\
```javascript\
GET/api/v1/vessel/finder\
http://api.jsoncargo.com/api/v1/vessel/finder\
```\
\
Copy\
\
API Key: ApiKeyAuth\
\
Header Parameter Name:\
\
```javascript\
x-api-key\
```\
\
Copy\
\
Query Parameters:\
\
| Data | Object |\
| --- | --- |\
| name | string |\
| fuzzy | integer |\
| type | string |\
| type\_specific | string |\
| country\_iso | string |\
| gross\_tonnage\_min | integer |\
| gross\_tonnage\_max | integer |\
| deadweight\_min | integer |\
| deadweight\_max | integer |\
| length\_min | number |\
| length\_max | number |\
| breadth\_min | number |\
| breadth\_max | number |\
| year\_built\_min | integer |\
| year\_built\_max | integer |\
| next | string |\
| page | string |\
| limit | string |\
\
Responses\
\
View response sample\
\
200 Vessel details retrieved successfully\
\
`Response Schema: application/json`\
\
| Data | Object |\
| --- | --- |\
| uuid | string |\
| name | string |\
| name\_ais | string or None |\
| mmsi | string or None |\
| imo | string or None |\
| eni | string or None |\
| country\_iso | string |\
| country\_name | string or None |\
| callsign | string or None |\
| type | string |\
| type\_specific | string |\
| gross\_tonnage | integer or None |\
| deadweight | integer or None |\
| teu | integer or None |\
| liquid\_gas | integer or None |\
| length | number |\
| breadth | number |\
| draught\_avg | number or None |\
| draught\_max | number or None |\
| speed\_avg | number or None |\
| speed\_max | number or None |\
| year\_built | integer or None |\
| is\_navaid | boolean |\
| home\_port | string or None |\
\
400 Invalid request\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
404 Vessel not found\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
429 Too many requests\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
500 Internal server error\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
Response sample:\
\
```javascript\
Content type\
application/json\
```\
\
Copy\
\
```javascript\
{"data": [\
{\
"uuid":"bd7614f7-82af-89d6-4d1b-7cf0d1bd0ce6",\
"name":"THALASSINI",\
"name_ais":"THALASSINI",\
"mmsi":"229609000",\
"imo":"9286592",\
"eni":null,\
"country_iso":"MT",\
"country_name":"Malta",\
"callsign":"9HA3445",\
"type":"Cargo",\
"type_specific":"Bulk Carrier",\
"gross_tonnage":42887,\
"deadweight":82977,\
"teu":null,\
"liquid_gas":null,\
"length":228.99,\
"breadth":32.26,\
"draught_avg":null,\
"draught_max":null,\
"speed_avg":null,\
"speed_max":null,\
"year_built":"2005",\
"is_navaid":false,\
"home_port":"VALLETTA"},\
{\
"uuid":"c396d62a-7643-e57f-1f35-bc725cfd5a27",\
"name":"THALASSINI",\
"name_ais":"THALASSINI",\
"mmsi":"205535790",\
"imo":null,\
"eni":"6105582",\
"country_iso":"BE",\
"country_name":"Belgium",\
"callsign":"OT5357",\
"type":"Cargo",\
"type_specific":"Inland, Motor Freighter",\
"gross_tonnage":null,\
"deadweight":null,\
"teu":null,"liquid_gas":null,\
"length":110,\
"breadth":11.5,\
"draught_avg":null,\
"draught_max":null,\
"speed_avg":null,\
"speed_max":null,\
"year_built":null,\
"is_navaid":false,\
"home_port":null\
  }\
}\
```\
\
Copy\
\
### Endpoint 7: Vessel Specs Details API\
\
Fetches static ship data using uuid, mmsi, or imo as query parameters.\
\
```javascript\
Authorizations: ApiKeyAuth\
```\
\
Copy\
\
```javascript\
GET/api/v1/vessel/specs\
http://api.jsoncargo.com/api/v1/vessel/specs\
```\
\
Copy\
\
API Key: ApiKeyAuth\
\
Header Parameter Name:\
\
```javascript\
x-api-key\
```\
\
Copy\
\
Query Parameters:\
\
| Data | Object |\
| --- | --- |\
| uuid | string |\
| mmsi | string |\
| imo | string |\
| page | string |\
| limit | string |\
\
Responses\
\
View response sample\
\
200 Vessel details retrieved successfully\
\
`Response Schema: application/json`\
\
| Data | Object |\
| --- | --- |\
| uuid | string |\
| name | string |\
| name\_ais | string or None |\
| mmsi | string or None |\
| imo | string or None |\
| eni | string or None |\
| country\_iso | string |\
| country\_name | string or None |\
| callsign | string or None |\
| type | string |\
| type\_specific | string |\
| gross\_tonnage | integer or None |\
| deadweight | integer or None |\
| teu | integer or None |\
| liquid\_gas | integer or None |\
| length | number |\
| breadth | number |\
| draught\_avg | number or None |\
| draught\_max | number or None |\
| speed\_avg | number or None |\
| speed\_max | number or None |\
| year\_built | integer or None |\
| is\_navaid | boolean |\
| home\_port | string or None |\
\
400 Invalid request\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
404 Vessel not found\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
429 Too many requests\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
500 Internal server error\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
Response sample:\
\
```javascript\
Content type\
application/json\
```\
\
Copy\
\
```javascript\
{\
"data": {\
"uuid": "b8625b67-7142-cfd1-7b85-595cebfe4191",\
"name": "MAERSK CHENNAI",\
"name_ais": "MAERSK CHENNAI",\
"mmsi": "566093000",\
"imo": "9525338",\
"eni": null,\
"country_iso": "SG",\
"country_name": "Singapore",\
"callsign": "9V9409",\
"type": "Cargo - Hazard A (Major)",\
"type_specific": "Container Ship",\
"gross_tonnage": 50869,\
"deadweight": 68898,\
"teu": "4500",\
"liquid_gas": null,\
"length": 249.12,\
"breadth": 37.4,\
"draught_avg": 10.021295387634936,\
"draught_max": 14.2,\
"speed_avg": 7.4,\
"speed_max": 20,\
"year_built": "2011",\
"is_navaid": false,\
"home_port": "SINGAPORE"\
}\
}\
```\
\
Copy\
\
### Endpoint 8: Port Finder\
\
Endpoints for finding and retrieving port details.\
\
```javascript\
Authorizations: ApiKeyAuth\
```\
\
Copy\
\
```javascript\
GET/api/v1/port/find\
http://api.jsoncargo.com/api/v1/port/find\
```\
\
Copy\
\
API Key: ApiKeyAuth\
\
Header Parameter Name:\
\
```javascript\
x-api-key\
```\
\
Copy\
\
Query Parameters:\
\
| Object | Data |\
| --- | --- |\
| lat | number |\
| lon | number |\
| radius | number |\
| name | string |\
| country\_iso | string |\
| port\_type | string |\
| fuzzy | integer |\
| page | string |\
| limit | string |\
\
Responses\
\
View response sample\
\
200 Port details retrieved successfully\
\
`Response Schema: application/json`\
\
| Data | Array of objects |\
| --- | --- |\
| port\_name | string |\
| port\_code | string or None |\
| country | string or None |\
| lat | number |\
| lon | number |\
| port\_type | string |\
| size | string or None |\
| area | string or None |\
| city | string or None |\
| unlocode | string |\
\
400 Invalid request\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
404 Port not found\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
429 Too many requests\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
500 Internal server error\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
Response sample:\
\
```javascript\
Content type\
application/json\
```\
\
Copy\
\
```javascript\
{\
  "data": [\
    {\
      "uuid": "17f4481e-801a-2c57-a356-e8ccf561f14f",\
      "port_name": "LONDON",\
      "country_iso": "GB",\
      "country_name": "United Kingdom",\
      "unlocode": "GBLON",\
      "port_type": "Port",\
      "lat": 51.49743,\
      "lon": -0.04960075,\
      "area_lvl1": "UK Coast & Atlantic",\
      "area_lvl2": "North Sea"\
  }\
}\
```\
\
Copy\
\
### Endpoint 9: Terminal Finder API\
\
Endpoint for finding and retrieving terminal details.\
\
```javascript\
Authorizations: ApiKeyAuth\
```\
\
Copy\
\
```javascript\
GET/api/v1/terminal\
http://api.jsoncargo.com/api/v1/terminal\
```\
\
Copy\
\
API Key: ApiKeyAuth\
\
Header Parameter Name:\
\
```javascript\
x-api-key\
```\
\
Copy\
\
Query Parameters:\
\
| Object | Data |\
| --- | --- |\
| unlocode | string |\
| page | string |\
| limit | string |\
\
Responses\
\
View response sample\
\
200 Terminal details retrieved successfully\
\
`Response Schema: application/json`\
\
| Data | Object |\
| --- | --- |\
| unlocode | string |\
| alt\_unlocode | string |\
| code | string |\
| terminal\_name | string |\
| company\_name | string |\
| lat | float |\
| lon | float |\
| url | string |\
| address | string |\
\
400 Bad request\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| Unlocode not valid, must contain at least 2 characters | string |\
\
429 Too many requests\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
500 Internal server error\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
Response sample:\
\
```javascript\
Content type\
application/json\
```\
\
Copy\
\
```javascript\
{\
    "data": [{\
        "unlocode": "CNCQI",\
        "alt_unlocode": "CNCHQ",\
        "code": "CUNTAN",\
        "terminal_name": "CUNTAN TERMINAL",\
        "company_name": "CHONGQING INTERNATIONAL CONTAINER TERMINAL CO., LTD.",\
        "lat": "29.618056",\
        "lon": "106.591667",\
        "url": "http://www.cqgj.com.cn/",\
        "address": "No. 306, Hai'er Road, Jiangbei District, Chongqing, China"\
    }]\
}\
```\
\
Copy\
\
### Endpoint 10: Get API Key Usage Stats\
\
Fetches the API key usage statistics, including the total number of requests, requests made, and requests available.\
\
```javascript\
Authorizations: ApiKeyAuth\
```\
\
Copy\
\
```javascript\
GET/api/v1/api_key/stats\
http://api.jsoncargo.com/api/v1/api_key/stats\
```\
\
Copy\
\
API Key: ApiKeyAuth\
\
Header Parameter Name:\
\
```javascript\
x-api-key\
```\
\
Copy\
\
Responses\
\
View response sample\
\
200 API key stats retrieved successfully\
\
`Response Schema: application/json`\
\
| Data | Object |\
| --- | --- |\
| plan | string |\
| requests\_total | integer |\
| requests\_made | integer |\
| requests\_available | integer |\
\
404 API key stats not found\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
429 Too many requests\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
500 Internal server error\
\
`Response Schema: application/json`\
\
| Error | Object |\
| --- | --- |\
| title | string |\
\
Response sample:\
\
```javascript\
Content type\
application/json\
```\
\
Copy\
\
```javascript\
{\
  "data": {\
    "plan": "MARINER",\
    "requests_total": 2000,\
    "requests_made": 6,\
    "requests_available": 1994\
  }\
}\
```\
\
Copy\
\
### Programming Languages\
\
JSONCargo supports various programming languages. The language examples below is illustrative, JSONCargo API is not limited to these languages only.\
\
![jsoncargo curl container api](<Base64-Image-Removed>)\
\
```javascript\
curl --location 'http://api.jsoncargo.com/api/v1/containers/"PARAMETER_VALUE" \\
--header 'x-api-key: "YOUR_API_KEY"\
```\
\
Copy\
\
![jsoncargo go container api](<Base64-Image-Removed>)\
\
```javascript\
package main\
import (\
  "fmt"\
  "net/http"\
  "io"\
)\
func main() {\
  url := "http://api.jsoncargo.com/api/v1/containers/"PARAMETER_VALUE"\
  method := "GET"\
  client := &http.Client {\
  }\
  req, err := http.NewRequest(method, url, nil)\
  if err != nil {\
    fmt.Println(err)\
    return\
  }\
  req.Header.Add("x-api-key", "YOUR_API_KEY")\
  res, err := client.Do(req)\
  if err != nil {\
    fmt.Println(err)\
    return\
  }\
  defer res.Body.Close()\
  body, err := io.ReadAll(res.Body)\
  if err != nil {\
    fmt.Println(err)\
    return\
  }\
  fmt.Println(string(body))\
}\
```\
\
Copy\
\
![jsoncargo node container api](<Base64-Image-Removed>)\
\
```javascript\
const axios = require('axios');\
let config = {\
  method: 'get',\
  maxBodyLength: Infinity,\
  url: 'http://api.jsoncargo.com/api/v1/containers/"PARAMETER_VALUE",\
  headers: {\
    'x-api-key': "YOUR_API_KEY"\
  }\
};\
axios.request(config)\
.then((response) => {\
  console.log(JSON.stringify(response.data));\
})\
.catch((error) => {\
  console.log(error);\
});\
```\
\
Copy\
\
![jsoncargo ruby container api](<Base64-Image-Removed>)\
\
```javascript\
require "uri"\
require "net/http"\
url = URI("http://api.jsoncargo.com/api/v1/containers/"PARAMETER_VALUE")\
http = Net::HTTP.new(url.host, url.port);\
request = Net::HTTP::Get.new(url)\
request["x-api-key"] = "YOUR_API_KEY"\
response = http.request(request)\
puts response.read_body\
```\
\
Copy\
\
![jsoncargo php container api](<Base64-Image-Removed>)\
\
```javascript\
<?php\
$curl = curl_init();\
curl_setopt_array($curl, array(\
  CURLOPT_URL => 'http://api.jsoncargo.com/api/v1/containers/"PARAMETER_VALUE",\
  CURLOPT_RETURNTRANSFER => true,\
  CURLOPT_ENCODING => '',\
  CURLOPT_MAXREDIRS => 10,\
  CURLOPT_TIMEOUT => 0,\
  CURLOPT_FOLLOWLOCATION => true,\
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,\
  CURLOPT_CUSTOMREQUEST => 'GET',\
  CURLOPT_HTTPHEADER => array(\
    'x-api-key: "YOUR_API_KEY"\
  ),\
));\
$response = curl_exec($curl);\
curl_close($curl);\
echo $response;\
```\
\
Copy\
\
![jsoncargo Java container api](<Base64-Image-Removed>)\
\
```javascript\
OkHttpClient client = new OkHttpClient().newBuilder()\
  .build();\
MediaType mediaType = MediaType.parse("text/plain");\
RequestBody body = RequestBody.create(mediaType, "");\
Request request = new Request.Builder()\
  .url("http://api.jsoncargo.com/api/v1/containers/"PARAMETER_VALUE")\
  .method("GET", body)\
  .addHeader("x-api-key", "YOUR_API_KEY")\
  .build();\
Response response = client.newCall(request).execute();\
```\
\
Copy\
\
![jsoncargo python container api](<Base64-Image-Removed>)\
\
```javascript\
import requests\
url = "http://api.jsoncargo.com/api/v1/containers/"PARAMETER_VALUE"\
payload = {}\
headers = {\
  'x-api-key': "YOUR_API_KEY"\
}\
response = requests.request("GET", url, headers=headers, data=payload)\
print(response.text)\
```\
\
Copy\
\
### Need Help or Have Questions?\
\
If you need further assistance or encounter any issues while using our API please don’t hesitate to contact our support team. We’re here to help!\
\
Support email\
\
- support@jsoncargo.com\
\
General inquiries\
\
- info@jsoncargo.com\
\
We also value your feedback! Feel free to share your thoughts on how we can improve our services.