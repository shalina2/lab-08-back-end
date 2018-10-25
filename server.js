'use strict';

const express = require('express');
const cors = require('cors');
const superagent =require('superagent');
const pg =require('pg');
require('dotenv').config();
const PORT = process.env.PORT || 3000;
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.log(err));

const app = express();

app.use(cors());

function Location(query,data) {
  this.search_query =query;
  this.formatted_query = data.formatted_address;
  this.latitude = data.geometry.location.lat;
  this.longitude = data.geometry.location.lng;

}
Location.prototype.save = function() {
  let SQL = `
      INSERT INTO locations
          (search_query,formatted_query,latitude,longitude)
          VALUES($1,$2,$3,$4)`;
  let values =Object.values(this);
  client.query(SQL,values);
}
  

//This will take the location name and run the searchtolatlong() which will store the location information as an object that contains latitude,longitude and location name.
app.get('/location', searchToLatLong);

app.listen(PORT, () => console.log(`App is up on http://localhost:${PORT}`));

//This function takes in the query and makes the request to the API,then format the data that it gets into the object that we need.
function searchToLatLong(request, response) {
  const query = request.query.data

  const SQL = `SELECT * FROM locations WHERE search_query=$1`
  const values = [query];
  return client.query(SQL,values).then(results => {
    console.log(results);
    if (results.rowCount > 0){
      console.log('GOT DATA FROM SQL');
      response.send(results.rows[0]);

    }
    else { 
      const URL = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
      return superagent.get(URL)
        .then( data => {
          let location = new Location(query,data.body.results[0]);
          location.save();
          response.send(location);
          return location;
        })
        .catch(error => handleError(error));
    }
  });
}


//
/////weather

app.get('/weather', (request, response) => {
  searchWeather(request.query.data)
    .then( weatherData => {
      response.send(weatherData);
    })
    .catch(error => handleError(error));
})

function searchWeather(location){
  const URL = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${location.latitude},${location.longitude}`;
  
  return superagent.get(URL)
    .then( data => {
      let weatherData = data.body.daily.data.map( day => {
        return new Weather(day);
      })
      return weatherData;
    })
    .catch(error => handleError(error));
}

function Weather (day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0,15);
}


////YELP


app.get('/yelp', (request, response) => {
  searchYelp(request.query.data)//this is the formatted location objecy
    .then( yelpData => {
      response.send(yelpData);
    })
    .catch(error => handleError(error));
})

console.log('hi');

function searchYelp(location){
  const URL = `https://api.yelp.com/v3/businesses/search?latitude=${location.latitude}&longitude=${location.longitude}`;

  return superagent.get(URL)
    .set( 'Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then( data => {
      let yelpData = data.body.businesses.map( item => {
        return new Business(item);
      })
      console.log(yelpData);
      return yelpData;
    })
    .catch(error => handleError(error));
}



function Business(business) {
  this.name = business.name;
  this.image_url = business.image_url;
  this.price = business.price;
  this.rating = business.rating;
  this.url = business.url;
}

//////////errors
function handleError(error,response) {
  console.log('error',error);
  if(response){
    response.status(500).send('sorry there is no data')
  }
    
}
