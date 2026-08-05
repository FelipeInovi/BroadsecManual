import { describe, expect, it } from "vitest";
import { deploymentFor, parseEnvFile, parseRecipes, planCaptures } from "./capture.ts";

const deployments = {
  mv: {
    baseUrl: "https://medellin.inovisec.com/mv",
    verify: { route: "/#/broadsec-of-things", selector: "button::-p-text(Alarmas)" },
  },
  demo: {
    baseUrl: "https://web.inovisec.com/lv",
    verify: { route: "/#/broadsec-of-things", selector: "button::-p-text(Alarmas)" },
  },
};

const target = {
  deployments,
  auth: {
    route: "/login",
    userEnv: "BROADSEC_CAPTURE_USER",
    passwordEnv: "BROADSEC_CAPTURE_PASSWORD",
    userSelector: 'input[name="email"]',
    passwordSelector: 'input[name="password"]',
    submitSelector: "#submit-button",
    doneWhen: "nav",
  },
};

const recipe = (slot: string, over: Record<string, unknown> = {}) => ({
  slot,
  route: "/bot/alarms",
  dataReady: "table tbody tr",
  clip: ".panel",
  ...over,
});

const doc = (recipes: unknown[]) => ({ version: 1, target, recipes });

describe("parseRecipes", () => {
  it("accepts a well-formed document", () => {
    const parsed = parseRecipes(doc([recipe("bot.alarmas.fig")]));
    expect(parsed.recipes).toHaveLength(1);
    expect(parsed.target.deployments["mv"]?.baseUrl).toBe("https://medellin.inovisec.com/mv");
  });

  // A run that cannot check it reached the right place before shooting would
  // deliver a whole batch of wrong images in one go.
  it("refuses a deployment with no reachability check", () => {
    const bad = { mv: { baseUrl: "https://x/mv" } };
    expect(() => parseRecipes({ version: 1, target: { deployments: bad, auth: target.auth }, recipes: [] })).toThrow(
      /verify/,
    );
  });

  // The single rule that keeps this from producing garbage. A route can render
  // its chrome — header, empty table, spinner gone — long before any data
  // arrives, and a screenshot of an empty alarms list teaches the operator that
  // the screen is empty. That is worse than the placeholder it replaced.
  it("refuses a recipe with no proof that DATA arrived", () => {
    expect(() => parseRecipes(doc([recipe("bot.alarmas.fig", { dataReady: undefined })]))).toThrow(
      /dataReady/,
    );
  });

  it("refuses an empty dataReady, which would satisfy the schema and prove nothing", () => {
    expect(() => parseRecipes(doc([recipe("bot.alarmas.fig", { dataReady: "  " })]))).toThrow(
      /dataReady/,
    );
  });

  // Credentials in a file get committed. The recipe names the VARIABLE.
  it("refuses a literal password anywhere in the auth block", () => {
    const bad = { ...target, auth: { ...target.auth, password: "hunter2" } };
    expect(() => parseRecipes({ version: 1, target: bad, recipes: [recipe("a")] })).toThrow(
      /password/i,
    );
  });

  // The whole BoT module is ONE route; its sections are sidebar state. So a
  // route alone cannot reach the Alarmas pane and a recipe needs clicks. The
  // product puts no test id on those buttons and its repository is read-only,
  // so the only stable handle is the visible label — which comes from the same
  // i18n catalogue the manual already quotes its labels from.
  it("accepts the clicks needed to reach a pane that has no route of its own", () => {
    const parsed = parseRecipes(
      doc([recipe("bot.alarmas.fig", { steps: [{ click: "button::-p-text(Alarmas)" }] })]),
    );
    expect(parsed.recipes[0]?.steps).toHaveLength(1);
  });

  it("refuses an empty click selector, which would silently click nothing", () => {
    expect(() =>
      parseRecipes(doc([recipe("bot.alarmas.fig", { steps: [{ click: " " }] })])),
    ).toThrow(/click/);
  });

  it("refuses two recipes claiming the same slot", () => {
    expect(() =>
      parseRecipes(doc([recipe("bot.alarmas.fig"), recipe("bot.alarmas.fig", { route: "/x" })])),
    ).toThrow(/bot\.alarmas\.fig/);
  });
});

describe("deploymentFor", () => {
  const parsed = () => parseRecipes(doc([recipe("bot.alarmas.fig")]));

  it("picks the deployment for the tenant being built", () => {
    expect(deploymentFor(parsed(), "mv").baseUrl).toBe("https://medellin.inovisec.com/mv");
    expect(deploymentFor(parsed(), "demo").baseUrl).toBe("https://web.inovisec.com/lv");
  });

  // The alternative is capturing mv's figures off whatever deployment happens to
  // be first in the file, which is the exact mistake this indirection exists to
  // stop. The message lists what IS configured so the fix is obvious.
  it("refuses a tenant with no deployment, and says which ones exist", () => {
    expect(() => deploymentFor(parsed(), "med")).toThrow(/med/);
    expect(() => deploymentFor(parsed(), "med")).toThrow(/mv, demo|demo, mv/);
  });
});

describe("parseEnvFile", () => {
  it("reads a plain KEY=VALUE", () => {
    expect(parseEnvFile("BROADSEC_CAPTURE_USER=operador@inovisec.com")).toEqual({
      BROADSEC_CAPTURE_USER: "operador@inovisec.com",
    });
  });

  it("ignores blank lines and comments", () => {
    const got = parseEnvFile("# el usuario\n\nA=1\n   \n# otro\nB=2\n");
    expect(got).toEqual({ A: "1", B: "2" });
  });

  // A password is not prose. Treating a "#" as the start of a comment would
  // silently truncate it and the login would fail with no clue why.
  it("keeps a # inside a value — it is a password character, not a comment", () => {
    expect(parseEnvFile("P=abc#123")).toEqual({ P: "abc#123" });
  });

  it("keeps an = inside a value, splitting on the first one only", () => {
    expect(parseEnvFile("P=a=b=c")).toEqual({ P: "a=b=c" });
  });

  it("strips surrounding quotes, so a value with spaces survives", () => {
    expect(parseEnvFile('P="con espacio"\nQ=\'otro\'')).toEqual({ P: "con espacio", Q: "otro" });
  });

  // Trailing whitespace is invisible in an editor and would be typed into the
  // password field verbatim.
  it("trims the key and unquoted value", () => {
    expect(parseEnvFile("  A  =  hola  ")).toEqual({ A: "hola" });
  });

  it("keeps deliberate whitespace when the value is quoted", () => {
    expect(parseEnvFile('A="  hola  "')).toEqual({ A: "  hola  " });
  });

  it("survives CRLF, which is what an editor writes on this machine", () => {
    expect(parseEnvFile("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  it("skips a line with no = rather than throwing on a half-typed file", () => {
    expect(parseEnvFile("A=1\nbasura\nB=2")).toEqual({ A: "1", B: "2" });
  });
});

describe("planCaptures", () => {
  const pending = new Set(["bot.alarmas.fig", "bot.cctv.fig", "bot.pmv.fig"]);

  it("plans only the pending slots a recipe covers", () => {
    const plan = planCaptures([recipe("bot.alarmas.fig"), recipe("bot.cctv.fig")], pending);
    expect(plan.ready.map((r) => r.slot)).toEqual(["bot.alarmas.fig", "bot.cctv.fig"]);
  });

  it("reports the pending slots nobody wrote a recipe for", () => {
    const plan = planCaptures([recipe("bot.alarmas.fig")], pending);
    expect(plan.uncovered).toEqual(["bot.cctv.fig", "bot.pmv.fig"]);
  });

  // Same rule the image manifest enforces: extraction cannot create demand. A
  // recipe for a slot nobody asks for would deliver an orphan file, and the
  // undeclared check would then report it as a stray.
  it("refuses a recipe for a slot that is not pending", () => {
    expect(() => planCaptures([recipe("bot.nope.fig")], pending)).toThrow(/bot\.nope\.fig/);
  });

  it("says so plainly when a delivered slot is re-listed, rather than re-shooting it", () => {
    expect(() => planCaptures([recipe("already.delivered")], pending)).toThrow(/not pending/i);
  });

  it("carries the delivery path, so a capture lands on the file the manual asked for", () => {
    const plan = planCaptures([recipe("bot.alarmas.fig")], pending);
    expect(plan.ready[0]?.deliverTo).toBe("_common/bot.alarmas.fig.png");
  });

  it("plans nothing at all when every recipe is already delivered", () => {
    const plan = planCaptures([], pending);
    expect(plan.ready).toHaveLength(0);
    expect(plan.uncovered).toHaveLength(3);
  });
});
