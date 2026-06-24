# =========================================================
#  Mega7.API - Dockerfile para Railway
#  Build context: raíz de la solución (carpeta Mega7)
# =========================================================

# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# 1) Copiar solo los .csproj y restaurar (capa cacheable)
COPY ["Mega7.API/Mega7.API.csproj", "Mega7.API/"]
COPY ["Mega7.SHARED/Mega7.SHARED.csproj", "Mega7.SHARED/"]
RUN dotnet restore "Mega7.API/Mega7.API.csproj"

# 2) Copiar el código y publicar en Release
COPY Mega7.API/ Mega7.API/
COPY Mega7.SHARED/ Mega7.SHARED/
RUN dotnet publish "Mega7.API/Mega7.API.csproj" \
    -c Release -o /app/publish /p:UseAppHost=false

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Dependencias nativas para QuestPDF (SkiaSharp) en Linux:
# libfontconfig1 + una familia de fuentes para renderizar texto.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libfontconfig1 fontconfig fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# Railway inyecta la variable PORT; Program.cs ya la usa para escuchar.
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "Mega7.API.dll"]
