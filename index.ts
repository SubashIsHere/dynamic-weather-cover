import express from "express";
import {
  Canvas,
  CanvasRenderingContext2D,
  createCanvas,
  loadImage,
} from "canvas";
import { WeatherData } from "interfaces";
import Config from "./config";
const app = express();
const CanvasWidth = 1170;
const CanvasHeight = 230;

app.get("/", async (req, res) => {
  let canvas = createCanvas(CanvasWidth, CanvasHeight);
  let location =
    req.query.location?.toString() || (req.socket.remoteAddress as string);
  let weatherData = await getWeather(location);
  await generateImage(canvas, weatherData);

  res.writeHead(200, {
    "Content-Type": "image/png",
  });
  res.end(canvas.toBuffer("image/png"));
});

async function getWeather(location: string) {
  let key = Config.weatherApiKey;
  const URI = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${location}`;
  let weatherData = (await (await fetch(URI)).json()) as WeatherData;
  return weatherData;
}

async function generateImage(canvas: Canvas, weatherData: WeatherData) {
  let ctx = canvas.getContext("2d");
  ctx.fillStyle = Config.bgColor;
  ctx.fillRect(0, 0, CanvasWidth, CanvasHeight);

  ctx.fillStyle = Config.mainFontColor;
  ctx.font = "40px " + Config.mainFontFamily;
  let location = `${weatherData.location.name}, ${weatherData.location.country}`;
  ctx.fillText(
    location,
    62,
    25 + ctx.measureText(location).actualBoundingBoxAscent
  );

  let currentWeatherData = weatherData.current;
  let imageLink = ("https:" + currentWeatherData.condition.icon).replaceAll(
    "64",
    "128"
  );
  let weatherImage = await loadImage(imageLink);
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 5;
  ctx.drawImage(weatherImage, 62, 52);

  ctx.font = "25px " + Config.mainFontFamily;
  let currentDate = dateGenerator(
    currentWeatherData.last_updated_epoch,
    weatherData.location.tz_id
  );
  let weatherStatus = `${currentWeatherData.condition.text} · ${currentDate}`;
  ctx.fillText(
    weatherStatus,
    62,
    176 + ctx.measureText(weatherStatus).actualBoundingBoxAscent
  );

  ctx.font = "70px " + Config.mainFontFamily;
  let temperature = currentWeatherData.temp_c.toString();
  let temperatureWidth = ctx.measureText(temperature).width;
  ctx.fillText(
    temperature,
    200,
    weatherImage.height / 2.5 +
      70 / 2 +
      ctx.measureText(temperature).actualBoundingBoxAscent
  );
  ctx.font = "30px " + Config.mainFontFamily;
  let unit = "°C";
  ctx.fillText(
    unit,
    200 + temperatureWidth,
    90 + ctx.measureText(unit).actualBoundingBoxAscent
  );

  ctx.font = "20px " + Config.mainFontFamily;
  ctx.fillStyle = "#3E3E3E";
  let windSpeedY = 90 + ctx.measureText(unit).actualBoundingBoxAscent;
  let windSpeedX = 250 + temperatureWidth;
  let windSpeed = `Wind: ${currentWeatherData.wind_kph} KMPH`;
  ctx.fillText(windSpeed, windSpeedX, windSpeedY);
  let windSpeedWidth = ctx.measureText(windSpeed).width;
  let humidity = `humidity: ${currentWeatherData.humidity}%`;
  ctx.fillText(humidity, windSpeedX, windSpeedY + 30);

  await drawForecast(ctx, weatherData, windSpeedX + windSpeedWidth, windSpeedY);
}

async function drawForecast(
  ctx: CanvasRenderingContext2D,
  weatherData: WeatherData,
  startingXcoords: number,
  y: number
) {
  let forecast = weatherData.forecast;
  let today = forecast.forecastday[0];
  let lastHourWeather = {
    code: 0,
    forLastXhours: 0,
  };
  let hours = today?.hour.filter((hour) => {
    if (hour.time_epoch > weatherData.current.last_updated_epoch) {
      if (hour.condition.code == lastHourWeather.code) {
        if (lastHourWeather.forLastXhours < 2) {
          lastHourWeather.forLastXhours++;
          return false;
        } else lastHourWeather.forLastXhours = 0;
      }
      lastHourWeather.code = hour.condition.code;
      return true;
    }
    return false;
  });

  if (typeof hours != "undefined") {
    let lastTimeInHour = "";
    for (let i = 0; i < 7 && i < hours.length; i++) {
      let hour = hours[i];
      if (!hour) return;
      let timeInHour = new Date(hour.time_epoch * 1000).toLocaleTimeString([], {
        timeZone: weatherData.location.tz_id,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      let image = await loadImage("http:" + hour.condition.icon);
      let temperature = Math.round(hour.temp_c) + "°C";

      let columnGap = ctx.measureText(lastTimeInHour).width + 30;
      lastTimeInHour = timeInHour;
      let x = startingXcoords + 30 + i * columnGap;

      ctx.fillText(timeInHour, x, y);
      ctx.drawImage(image, x, y, 64, 64);
      ctx.fillText(temperature, x, y + 80);
    }
  }
}

function dateGenerator(epochTime: number, timeZone: string) {
  const date = new Date(epochTime * 1000);
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone,
    weekday: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).format(date);

  return formattedTime;
}

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
