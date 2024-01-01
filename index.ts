import express from "express";
import { Canvas, createCanvas, loadImage } from "canvas";
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
  let windSpeedHight = 90 + ctx.measureText(unit).actualBoundingBoxAscent;
  let windSpeed = `Wind: ${currentWeatherData.wind_kph} KMPH`;
  ctx.fillText(windSpeed, 250 + temperatureWidth, windSpeedHight);
  let humidity = `humidity: ${currentWeatherData.humidity}%`;
  ctx.fillText(humidity, 250 + temperatureWidth, windSpeedHight + 30);
}

function dateGenerator(epochTime: number, timeZone: string) {
  const date = new Date(epochTime * 1000);
  const formattedTime = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone,
    weekday: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);

  return formattedTime;
}

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
