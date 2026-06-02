function FooterCredit() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "10px",
        right: "15px",
        fontSize: "16px",
        color: "#888",
        zIndex: 9999,
        userSelect: "none",
      }}
    >
      Made with ❤️ by{" "}
      <a
        href="https://www.linkedin.com/in/vamshi-kasturi/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "#788aff",
          textDecoration: "none",
          fontWeight: "600",
        }}
      >
        Vamshi Kasturi
      </a>
    </div>
  );
}

export default FooterCredit;