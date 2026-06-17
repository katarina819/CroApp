const BASE_URL = "http://10.206.222.205:7089";

const NUMBER_OF_USERS = 100;

let users = [];
let durations = [];
let failures = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createUsers() {
  console.log("Kreiranje mock korisnika...");

  for (let i = 1; i <= NUMBER_OF_USERS; i++) {
    const user = {
      username: `mockuser${i}`,
      firstName: `Mock${i}`,
      lastName: "User",
      email: `mockuser${i}@test.com`,
      password: "Test123",
      birthDate: "2000-01-01",
    };

    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });

      if (response.ok || response.status === 409) {
        // 409 znači da korisnik već postoji
        users.push(user);

        console.log(`Korisnik ${user.username} spreman (${response.status})`);
      } else {
        console.log(`${user.username} nije kreiran (${response.status})`);

        console.log(await response.text());
      }
    } catch (err) {
      console.error(err);
    }
  }
}

async function virtualUser(user) {
  try {
    const start = performance.now();

    // LOGIN
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: user.username,
        password: user.password,
      }),
    });

    if (!loginRes.ok) {
      failures++;

      console.log(`Login fail ${user.username} (${loginRes.status})`);

      return;
    }

    const loginData = await loginRes.json();

    // VIDEO
    const videoRes = await fetch(`${BASE_URL}/api/video`, {
      headers: {
        Authorization: `Bearer ${loginData.token}`,
      },
    });

    if (!videoRes.ok) {
      failures++;

      console.log(`/api/video fail ${user.username} (${videoRes.status})`);

      return;
    }

    const duration = performance.now() - start;

    durations.push(duration);

    console.log(`${user.username}: ${duration.toFixed(2)} ms`);
  } catch (err) {
    failures++;
    console.error(err);
  }
}

async function main() {
  const totalStart = performance.now();

  await createUsers();

  console.log("\nPokretanje load testa...\n");

  await Promise.all(users.map((user) => virtualUser(user)));

  console.log("\n===== REZULTATI =====");

  console.log("Broj korisnika:", users.length);
  console.log("Uspješni zahtjevi:", durations.length);
  console.log("Greške:", failures);

  if (durations.length > 0) {
    durations.sort((a, b) => a - b);

    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

    const p95 =
      durations[
        Math.min(Math.floor(durations.length * 0.95), durations.length - 1)
      ];

    console.log("Prosjek:", avg.toFixed(2), "ms");
    console.log("95. percentil:", p95.toFixed(2), "ms");
    console.log("Max:", Math.max(...durations).toFixed(2), "ms");
  }

  console.log(
    "Ukupno trajanje:",
    ((performance.now() - totalStart) / 1000).toFixed(2),
    "s",
  );
}

main();
