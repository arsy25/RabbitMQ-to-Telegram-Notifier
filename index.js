require("dotenv").config();

const amqp = require("amqplib");
const axios = require("axios");

const RABBITMQ_CONFIG = {
  protocol: process.env.RABBITMQ_PROTOCOL || "amqp",
  hostname: process.env.RABBITMQ_HOST,
  port: parseInt(process.env.RABBITMQ_PORT, 10) || 5672,
  username: process.env.RABBITMQ_USER,
  password: process.env.RABBITMQ_PASSWORD,
  vhost: process.env.RABBITMQ_VHOST || "/",
  heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT, 10) || 60,
  timeout: parseInt(process.env.RABBITMQ_TIMEOUT, 10) || 10000,
};

const QUEUE = process.env.RABBITMQ_QUEUE;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await axios.post(url, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
  });

  if (!response.data.ok) {
    throw new Error(response.data.description || "Telegram API error");
  }

  console.log("📱 Telegram message sent");
}

async function connectRabbitMQ() {
  console.log("🔌 Connecting to RabbitMQ...");
  console.log(`   Host : ${RABBITMQ_CONFIG.hostname}`);
  console.log(`   Port : ${RABBITMQ_CONFIG.port}`);
  console.log(`   User : ${RABBITMQ_CONFIG.username}`);
  console.log(`   VHost: ${RABBITMQ_CONFIG.vhost}`);

  const connection = await amqp.connect(RABBITMQ_CONFIG);

  console.log("✅ RabbitMQ connected");

  connection.on("error", (error) => {
    console.error("❌ RabbitMQ connection error:", error.message);
  });

  connection.on("close", () => {
    console.log("⚠️ RabbitMQ connection closed");
  });

  return connection;
}

async function start() {
  while (true) {
    try {
      const connection = await connectRabbitMQ();

      const channel = await connection.createChannel();

      await channel.assertQueue(QUEUE, {
        durable: true,
      });

      channel.prefetch(1);

      console.log(`📥 Queue : ${QUEUE}`);
      console.log("👂 Waiting for messages...\n");

      await new Promise((resolve, reject) => {
        channel.consume(
          QUEUE,
          async (msg) => {
            if (!msg) {
              return;
            }

            try {
              const rawMessage = msg.content.toString();

              console.log("================================");
              console.log("📨 MESSAGE RECEIVED");
              console.log("================================");
              console.log(rawMessage);

              let telegramMessage = rawMessage;

              try {
                const data = JSON.parse(rawMessage);

                telegramMessage =
                  `${data.message}\n\n` +
                  `📡 DATA SENSOR\n` +
                  `Distance  : ${data.value}`;
              } catch {
              }

              await sendTelegram(telegramMessage);

              channel.ack(msg);

              console.log("✅ Message ACK\n");
            } catch (error) {
              console.error("❌ Failed processing message:", error.message);
              channel.nack(msg, false, true);
            }
          },
          {
            noAck: false,
          }
        );

        connection.once("close", resolve);
        connection.once("error", reject);
      });
    } catch (error) {
      console.error("❌ RabbitMQ error:", error.message);

      console.log("🔄 Retrying in 5 seconds...\n");

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

const requiredEnv = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "RABBITMQ_HOST",
  "RABBITMQ_USER",
  "RABBITMQ_PASSWORD",
  "RABBITMQ_QUEUE",
];

const missingEnv = requiredEnv.filter((env) => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(`❌ Environment variables berikut belum di-set: ${missingEnv.join(", ")}`);
  process.exit(1);
}

start();