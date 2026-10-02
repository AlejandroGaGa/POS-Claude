/**
 * Crea el usuario administrador inicial y (opcional) productos de ejemplo.
 *   npm run seed                 → solo admin
 *   npm run seed -- --demo       → admin + productos de ejemplo + vendedor demo
 *   npm run seed -- --reset      → si el admin ya existe, le pone la contraseña de SEED_ADMIN_PASSWORD y lo reactiva
 */
import "dotenv/config";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

config({ path: ".env.local" });

async function main() {
  const { connectDB } = await import("../src/lib/db");
  const { User } = await import("../src/lib/models/User");
  const { Product } = await import("../src/lib/models/Product");
  await connectDB();

  const username = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 6) throw new Error("Define SEED_ADMIN_PASSWORD (mínimo 6 caracteres) en .env.local");

  const exists = await User.findOne({ username });
  if (exists && process.argv.includes("--reset")) {
    exists.passwordHash = await bcrypt.hash(password, 10);
    exists.role = "admin";
    exists.active = true;
    await exists.save();
    console.log(`✓ Contraseña del usuario "${username}" restablecida.`);
  } else if (exists) console.log(`• El usuario "${username}" ya existe, no se modifica (usa --reset para cambiarle la contraseña).`);
  else {
    await User.create({ name: process.env.SEED_ADMIN_NAME || "Administrador", username, role: "admin", passwordHash: await bcrypt.hash(password, 10) });
    console.log(`✓ Administrador "${username}" creado.`);
  }

  if (process.argv.includes("--demo")) {
    const demo = [
      { code: "PER-2C-NAT", name: 'Cabezal 2"', category: "Aluminio", line: 'Línea 2"', color: "Natural", unitType: "perfil", unitLabel: "tira", pricePerMeter: 95, bars: [{ lengthM: 6, price: 520 }, { lengthM: 3.6, price: 330 }, { lengthM: 4.6, price: 410 }], minCutM: 0.5 },
      { code: "PER-2J-NAT", name: 'Jamba 2"', category: "Aluminio", line: 'Línea 2"', color: "Natural", unitType: "perfil", unitLabel: "tira", pricePerMeter: 88, bars: [{ lengthM: 6, price: 480 }], minCutM: 0.5 },
      { code: "PER-35R-BCO", name: "Riel inferior Serie 35", category: "Aluminio", line: "Serie 35", color: "Blanco", unitType: "perfil", unitLabel: "tira", pricePerMeter: 120, bars: [{ lengthM: 6, price: 660 }, { lengthM: 4.6, price: 520 }], minCutM: 0.5 },
      { code: "CLA-6", name: "Cristal claro 6 mm", category: "Vidrio", color: "Claro", unitType: "vidrio", unitLabel: "hoja", pricePerM2: 650, pricePerM2Vidriero: 450, sheets: [{ widthM: 1.8, heightM: 2.6, price: 1380 }, { widthM: 2.3, heightM: 2.6, price: 1795 }] },
      { code: "FIL-4", name: "Cristal filtrasol 4 mm", category: "Vidrio", color: "Filtrasol", unitType: "vidrio", unitLabel: "hoja", pricePerM2: 750, pricePerM2Vidriero: 500, sheets: [{ widthM: 1.8, heightM: 2.6, price: 1465 }] },
      { code: "ESP-3", name: "Espejo 3 mm", category: "Vidrio", unitType: "vidrio", unitLabel: "hoja", pricePerM2: 350 },
      { code: "ESM-100", name: "Esmeril grano 100", category: "Abrasivos", unitType: "kg", unitLabel: "kg", price: 120 },
      { code: "FEL-5", name: "Felpa 5 mm", category: "Accesorios", color: "Gris", unitType: "metro", unitLabel: "m", price: 6.5 },
      { code: "VIN-CU", name: "Vinil cuña", category: "Accesorios", unitType: "metro", unitLabel: "m", price: 4 },
      { code: "JAL-CON", name: "Jaladera de concha", category: "Herrajes", color: "Natural", unitType: "pieza", unitLabel: "pza", price: 35 },
      { code: "CHA-35", name: "Chapa embutir Serie 35", category: "Herrajes", unitType: "pieza", unitLabel: "pza", price: 145 },
      { code: "RUE-2", name: 'Rodaja 2" doble', category: "Herrajes", unitType: "pieza", unitLabel: "par", price: 58 },
      { code: "SIL-TRA", name: "Silicón transparente 280 ml", category: "Selladores", unitType: "pieza", unitLabel: "pza", price: 89 },
      { code: "PIJ-8", name: "Pija 8 × 1/2 (caja 100)", category: "Tornillería", unitType: "pieza", unitLabel: "caja", price: 75 },
    ];
    for (const p of demo) await Product.updateOne({ code: p.code }, { $setOnInsert: p }, { upsert: true });
    console.log(`✓ ${demo.length} productos de ejemplo listos.`);

    if (!(await User.findOne({ username: "mostrador" }))) {
      await User.create({ name: "Vendedor demo", username: "mostrador", role: "vendedor", passwordHash: await bcrypt.hash("mostrador123", 10) });
      console.log('✓ Vendedor demo: usuario "mostrador" / contraseña "mostrador123" (cámbiala o desactívalo).');
    }
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("✗", e.message);
  await mongoose.disconnect();
  process.exit(1);
});
