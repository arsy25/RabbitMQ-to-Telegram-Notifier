# RabbitMQ to Telegram Notifier

A Node.js service that consumes messages from a RabbitMQ queue and forwards them as notifications to a Telegram chat via the Telegram Bot API. Well suited for monitoring/alerting use cases where sensors or other systems publish messages to RabbitMQ.

## Features

- Auto-reconnects to RabbitMQ if the connection drops (retries every 5 seconds).
- Supports both JSON-formatted messages (with `message` and `value` fields) and plain text messages.
- Manual ack/nack: a message is only acknowledged after it's successfully sent to Telegram; on failure it's requeued (`requeue`).
- Validates required environment variables on startup.
- Prefetch of 1 (processes one message at a time).

## Prerequisites

- Node.js (v18 or later recommended)
- Access to a RabbitMQ server/broker
- A Telegram bot (token from [@BotFather](https://t.me/BotFather)) and the target Chat ID

## Installation

```bash
git clone <your-repo-url>
cd <project-folder>
npm install
```

Main dependencies used:

```bash
npm install amqplib axios dotenv
```

## Configuration

Create a `.env` file at the project root with the following content:

```env
# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_VHOST=/
RABBITMQ_QUEUE=your_queue_name
RABBITMQ_PROTOCOL=amqp
RABBITMQ_HEARTBEAT=60
RABBITMQ_TIMEOUT=10000

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_target_chat_id
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `RABBITMQ_HOST` | ✅ | - | RabbitMQ server hostname/IP |
| `RABBITMQ_PORT` | ❌ | `5672` | RabbitMQ port |
| `RABBITMQ_USER` | ✅ | - | RabbitMQ username |
| `RABBITMQ_PASSWORD` | ✅ | - | RabbitMQ password |
| `RABBITMQ_VHOST` | ❌ | `/` | RabbitMQ virtual host |
| `RABBITMQ_QUEUE` | ✅ | - | Name of the queue to consume from |
| `RABBITMQ_PROTOCOL` | ❌ | `amqp` | Connection protocol (`amqp`/`amqps`) |
| `RABBITMQ_HEARTBEAT` | ❌ | `60` | Heartbeat interval (seconds) |
| `RABBITMQ_TIMEOUT` | ❌ | `10000` | Connection timeout (ms) |
| `TELEGRAM_BOT_TOKEN` | ✅ | - | Telegram bot token from BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | - | Target chat/group/channel ID for notifications |

If any required variable is missing, the application will exit immediately with an error message.

## Running the Service

```bash
node index.js
```

Or add the following script to your `package.json`:

```json
"scripts": {
  "start": "node index.js"
}
```

then run:

```bash
npm start
```

## How It Works

1. The service connects to RabbitMQ and ensures the queue (`RABBITMQ_QUEUE`) exists (durable).
2. Incoming messages are processed one at a time (prefetch 1).
3. If the message content is JSON in the format:
   ```json
   { "message": "Sensor Active", "value": 12.5 }
   ```
   it is reformatted into:
   ```
   Sensor Active

   📡 SENSOR DATA
   Distance  : 12.5
   ```
4. If the message content is not valid JSON, it is forwarded to Telegram as-is (plain text).
5. Once the message is successfully sent to Telegram, it is *acknowledged* (ack) in RabbitMQ. If sending fails, the message is *nack*'d and requeued for reprocessing.
6. If the RabbitMQ connection drops (error/close), the service automatically attempts to reconnect every 5 seconds.

## Log Output

While running, the service prints logs like the following:

```
🔌 Connecting to RabbitMQ...
   Host : localhost
   Port : 5672
   User : guest
   VHost: /
✅ RabbitMQ connected
📥 Queue : your_queue_name
👂 Waiting for messages...

================================
📨 MESSAGE RECEIVED
================================
{"message":"Sensor Active","value":12.5}
📱 Telegram message sent
✅ Message ACK
```

## Troubleshooting

- **`Missing required environment variables`**: make sure all required variables from the table above are set in `.env`.
- **Failed to connect to RabbitMQ**: check the host, port, username, and password, and verify the vhost is correct. The service will automatically retry every 5 seconds.
- **Telegram messages not being sent**: make sure `TELEGRAM_BOT_TOKEN` is valid and the bot has been `/start`-ed by the target chat/group, and that `TELEGRAM_CHAT_ID` is correct (it can be negative for groups).

## License

Feel free to adapt this to your project's needs (e.g. MIT License).
