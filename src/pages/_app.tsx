import { Inter } from "next/font/google";
import { type AppType } from "next/app";
import "~/styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <div className={`${inter.variable} font-sans min-h-screen bg-zinc-950 text-zinc-100`}>
      <Component {...pageProps} />
    </div>
  );
};

export default MyApp;
