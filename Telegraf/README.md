# Telegraf Custom Service Setup

## This guide explains how to deploy a custom Telegraf configuration and service on a Wiren Board device.

## 1. Copy Configuration to Remote Device
Run this command from your local machine to copy the Telegraf config:

```sh
cat telegraf.conf | ssh root@192.168.1.2 'mkdir -p /etc/telegraf && cat > /etc/telegraf/telegraf.conf'
```

## 2. Create Custom Service File
Connect to the device via SSH:

```sh
ssh root@192.168.1.2
```

Create and edit the service file:

```sh
sudo nano /etc/systemd/system/my-telegraf.service
```

Paste this content:

```ini
[Unit]
Description=Custom Telegraf Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/telegraf --config /etc/telegraf/telegraf.conf
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## 3. Enable and Start Service
```sh
sudo systemctl daemon-reload
sudo systemctl enable my-telegraf.service
sudo systemctl start my-telegraf.service
```

## 4. Verify Service Status
```sh
systemctl status my-telegraf.service
```

## 5. View Logs
```sh
journalctl -u my-telegraf.service -f
```

# Troubleshooting

### - Permission Issues:
```sh
sudo chmod 644 /etc/telegraf/telegraf.conf
```

### - Config Validation:
```sh
telegraf --test --config /etc/telegraf/telegraf.conf
```

# Notes
- Replace `192.168.1.2` with your actual device IP
- Config path: `/etc/telegraf/telegraf.conf`
- Service name: `my-telegraf.service`