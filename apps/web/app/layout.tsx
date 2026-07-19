import "./globals.css"; import type { Metadata } from "next";
export const metadata:Metadata={title:"WarSneaks Command Center",description:"Business operations command center"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}
