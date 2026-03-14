# 12 — Smart Home

## Current State

No smart home integration exists in the platform.

## Goals

Integrate TP-Link Tapo smart home devices into the atlas platform for monitoring and control.

### Business Case

- Control Tapo devices (smart plugs, lights, cameras) from atlas dashboard
- Schedule device actions via atlas-scheduler
- Notifications on device state changes
- Centralized home automation control panel

## Tapo Device Integration

### Supported Devices

TP-Link Tapo product line:
- **Smart Plugs**: P100, P110 (with energy monitoring)
- **Smart Bulbs**: L510E, L530E (color), L630 (multicolor)
- **Smart Cameras**: C200, C210, C310 (outdoor)
- **Smart Switches**: S200B, S200D (dimmer)
- **Smart Hubs**: H100 (for sensors)
- **Sensors**: T100 (motion), T110 (door/window), T310 (temperature/humidity)

### Library

**`tp-link-tapo-connect`** — Node.js library for Tapo device control.

Or: **`tapo-api`** — alternative library.

```
npm install tp-link-tapo-connect
```

### Architecture

#### Option A: Integrate into atlas-core (simpler)
- Add smart home routes/controllers to atlas-core
- Pros: no new service
- Cons: mixes concerns

#### Option B: New service `atlas-home` (cleaner)
- Dedicated smart home service
- Pros: separation of concerns, can grow independently
- Cons: another service

**Recommended: Option A for now** — add to atlas-core as a module. Extract to separate service later if it grows.

### Backend Implementation

`apps/atlas-core/src/models/SmartDevice.ts`:
```
{
  name: string,              // user-friendly name
  type: string,              // 'plug', 'bulb', 'camera', 'sensor'
  brand: string,             // 'tapo'
  model: string,             // 'P110', 'L530E', etc.
  ip: string,                // device IP on local network
  credentials: {
    email: string,           // Tapo account email (encrypted)
    password: string         // Tapo account password (encrypted)
  },
  config: object,            // device-specific configuration
  lastSeen: Date,
  status: string,            // 'online', 'offline', 'unknown'
  userId: string
}
```

`apps/atlas-core/src/services/smartHomeService.ts`:
```
import { loginDevice, turnOn, turnOff, getDeviceInfo } from 'tp-link-tapo-connect';

class SmartHomeService {
  async getDeviceStatus(deviceId: string) {
    const device = await deviceDao.findById(deviceId);
    const tapoDevice = await loginDevice(device.ip, device.credentials.email, device.credentials.password);
    const info = await tapoDevice.getDeviceInfo();
    return {
      isOn: info.device_on,
      brightness: info.brightness,
      colorTemp: info.color_temp,
      energyUsage: info.current_power,  // P110 only
      signal: info.signal_level
    };
  }

  async controlDevice(deviceId: string, action: 'on' | 'off' | 'toggle', params?: object) {
    const device = await deviceDao.findById(deviceId);
    const tapoDevice = await loginDevice(device.ip, device.credentials.email, device.credentials.password);

    switch (action) {
      case 'on': await tapoDevice.turnOn(); break;
      case 'off': await tapoDevice.turnOff(); break;
      case 'toggle':
        const info = await tapoDevice.getDeviceInfo();
        info.device_on ? await tapoDevice.turnOff() : await tapoDevice.turnOn();
        break;
    }

    // For bulbs
    if (params?.brightness) await tapoDevice.setBrightness(params.brightness);
    if (params?.colorTemp) await tapoDevice.setColorTemperature(params.colorTemp);
    if (params?.color) await tapoDevice.setColor(params.color.hue, params.color.saturation);
  }

  async discoverDevices(networkRange: string) {
    // Scan network for Tapo devices
    // Use ARP scan or known port scanning
  }
}
```

### API Design

```
GET    /api/v1/home/devices               — list all devices
POST   /api/v1/home/devices               — add device
GET    /api/v1/home/devices/:id           — get device details + current status
PUT    /api/v1/home/devices/:id           — update device config
DELETE /api/v1/home/devices/:id           — remove device

POST   /api/v1/home/devices/:id/control   — control device (on/off/toggle/set)
GET    /api/v1/home/devices/:id/status    — get current status
GET    /api/v1/home/devices/:id/energy    — get energy usage (P110)
GET    /api/v1/home/devices/:id/history   — get status/energy history
POST   /api/v1/home/devices/discover      — scan network for devices
```

### Scheduler Integration

Create scheduled jobs for device control:

**Executor type: `smart-home`**

`apps/atlas-scheduler/src/executors/smarthome.ts`:
```
interface SmartHomeExecutorConfig {
  deviceId: string;
  action: 'on' | 'off' | 'toggle';
  params?: object;
}
```

**Use cases:**
- Turn off all lights at midnight
- Turn on coffee machine plug at 7am on weekdays
- Toggle garden lights at sunset (calculate time dynamically)

### Notification Integration

Send notifications on device events:
- Device goes offline → notification
- Energy usage exceeds threshold (P110) → notification
- Motion detected (camera/sensor) → notification
- Temperature out of range (T310 sensor) → notification

**Implemented via atlas-scheduler** — periodic device status check job that sends notifications through atlas-notify when conditions are met.

### GUI — Smart Home Dashboard

`apps/atlas-gui/src/app/(protected)/home/page.tsx`:

**Layout:**
- Grid of device cards
- Each card: device name, type icon, status (on/off), quick toggle button
- Energy monitoring cards for P110 plugs (current power, daily usage)
- Room grouping (optional — group devices by location)

**Device detail page:**

`apps/atlas-gui/src/app/(protected)/home/[id]/page.tsx`:
- Device info (name, model, IP, status)
- Control panel (on/off toggle, brightness slider, color picker for bulbs)
- Energy usage chart (for P110)
- Status history
- Linked schedules
- Settings (rename, change credentials, remove)

**Components:**

`apps/atlas-gui/src/components/home/`:
```
device-card.tsx          — device overview card with quick toggle
device-control.tsx       — control panel (toggle, sliders, color)
energy-chart.tsx         — energy usage visualization
device-add-dialog.tsx    — add new device form
device-discovery.tsx     — network scan results
room-group.tsx           — group devices by room
```

### Network Considerations

**Important:** Tapo devices communicate on the local network. The atlas server must be on the same network as the devices, or have VPN/routing access.

**For VPS deployment:** This means the smart home features only work if:
1. VPS is on the same network as devices (unlikely), or
2. A local bridge/agent runs on the home network and relays commands to VPS, or
3. Smart home module runs on a local device (RPi) that connects to atlas APIs

**Recommended: Option 2 or 3** — run a lightweight agent on the local network.

`packages/atlas-home-agent/`:
- Runs on local network (RPi, NAS, etc.)
- Connects to atlas-core via WebSocket or polls for commands
- Executes device commands locally
- Reports device status back to atlas

This is a more complex architecture but necessary for remote VPS + local IoT devices.

### Energy Monitoring (P110)

Store energy readings in time-series format:

```
{
  deviceId: string,
  timestamp: Date,
  currentPower: number,      // watts
  todayEnergy: number,       // watt-hours
  monthEnergy: number        // watt-hours
}
```

**Collection:** Per-device or shared with device ID index. Use TTL for auto-cleanup (keep 90 days).

**Scheduled collection:** atlas-scheduler job reads P110 energy data every 5 minutes, stores in MongoDB.

## Implementation Order

1. **Device model + CRUD** — add/remove/list devices
2. **Device control** — on/off/toggle via Tapo library
3. **Status polling** — periodic device status checks
4. **GUI — device dashboard** — grid of device cards with controls
5. **Scheduler executor** — smart-home job type
6. **Energy monitoring** — P110 data collection + charts
7. **Notifications** — alerts on device state changes
8. **Local agent** — bridge for remote VPS + local devices

## Dependencies

- `tp-link-tapo-connect` or `tapo-api` package
- Tapo account credentials
- Network access to Tapo devices (local network or agent bridge)
- For remote VPS: local agent running on home network
- atlas-scheduler for automated device actions
- atlas-notify for device alerts
