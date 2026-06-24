import "../globals.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/images/background-login.png')" }}
    >
      {/* Sutil overlay para mejor contraste */}
      <div className="absolute inset-0 bg-white/20 animate-fade-slow"></div>

      {/* Contenido */}
      <div className="relative z-10 flex items-center justify-center w-full">
        {children}
      </div>
    </div>
  );
}
