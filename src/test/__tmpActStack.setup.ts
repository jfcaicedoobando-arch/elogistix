const orig = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act")) {
    orig("ACTSTACK", new Error("act").stack);
    return;
  }
  orig(...(args as []));
};
