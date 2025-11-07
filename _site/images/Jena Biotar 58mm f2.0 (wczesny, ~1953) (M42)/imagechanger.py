import os
from PIL import Image, ImageDraw # Potrzebujesz biblioteki Pillow!

def convert_image_to_smaller_format(input_filepath, output_directory, target_format='jpeg', quality=85):
    """
    Konwertuje plik obrazu (np. PNG) na mniejszy format (JPEG lub WebP)
    ze zmniejszoną jakością, aby zredukować rozmiar pliku.

    Args:
        input_filepath (str): Pełna ścieżka do pliku wejściowego obrazu.
        output_directory (str): Ścieżka do katalogu, gdzie ma zostać zapisany nowy plik.
        target_format (str): Docelowy format ('jpeg' lub 'webp'). Domyślnie 'jpeg'.
        quality (int): Poziom jakości dla formatów JPEG/WebP (0-100). Domyślnie 85.
                       Wyższa jakość = większy rozmiar, niższa jakość = mniejszy rozmiar.

    Returns:
        str or None: Ścieżka do zapisanego pliku wyjściowego, lub None w przypadku błędu.
    """
    if not os.path.exists(input_filepath):
        print(f"Miau! Błąd: Plik wejściowy nie istnieje: {input_filepath}")
        return None

    if not os.path.isdir(output_directory):
        print(f"Miau! Tworzę katalog wyjściowy: {output_directory}")
        os.makedirs(output_directory, exist_ok=True)

    try:
        with Image.open(input_filepath) as img:
            base_filename = os.path.splitext(os.path.basename(input_filepath))[0]
            output_filename = f"{base_filename}.{target_format}"
            output_filepath = os.path.join(output_directory, output_filename)

            # Upewnij się, że obraz jest w trybie RGB dla JPEG, jeśli ma kanał alfa (przezroczystość),
            # ponieważ JPEG nie obsługuje przezroczystości.
            if target_format.lower() == 'jpeg':
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                img.save(output_filepath, format='JPEG', quality=quality, optimize=True)
            elif target_format.lower() == 'webp':
                # WebP obsługuje przezroczystość, więc nie ma potrzeby konwertowania RGBA do RGB.
                img.save(output_filepath, format='WEBP', quality=quality, optimize=True)
            else:
                print(f"Miau! Nierozpoznany format docelowy: {target_format}. Obsługiwane to 'jpeg' lub 'webp'.")
                return None

            # Wyświetl raport o rozmiarach tylko, jeśli konwersja się powiodła
            old_size_mb = os.path.getsize(input_filepath) / (1024 * 1024)
            new_size_mb = os.path.getsize(output_filepath) / (1024 * 1024)
            print(f"Miau! Konwersja '{input_filepath}' do '{output_filepath}' zakończona sukcesem!")
            print(f"   Stary rozmiar: {old_size_mb:.2f} MB")
            print(f"   Nowy rozmiar ({target_format.upper()} Quality {quality}): {new_size_mb:.2f} MB")
            if old_size_mb > 0:
                print(f"   Redukcja rozmiaru: {((old_size_mb - new_size_mb) / old_size_mb) * 100:.2f}%")
            return output_filepath
    except FileNotFoundError:
        print(f"Miau! Błąd: Plik nie został znaleziony: {input_filepath}")
        return None
    except Exception as e:
        print(f"Miau! Wystąpił błąd podczas konwersji pliku '{input_filepath}': {e}")
        return None

def create_dummy_image(filename, width, height, color, text):
    """Tworzy fikcyjny plik obrazu (PNG) do celów demonstracyjnych."""
    try:
        img = Image.new('RGBA', (width, height), color=color)
        d = ImageDraw.Draw(img)
        # Użyj domyślnego fontu, jeśli nie jest dostępny systemowy
        try:
            from PIL import ImageFont
            font = ImageFont.truetype("arial.ttf", int(height/15)) # Spróbuj z Arial
        except IOError:
            font = ImageFont.load_default() # Użyj domyślnego, jeśli Arial nie działa
            print("Miau! Nie można znaleźć fontu Arial, używam domyślnego.")

        d.text((50, 50), text, fill=(0, 0, 0, 255), font=font) # Czarny tekst
        img.save(filename, format='PNG') # Zapisujemy jako PNG
        print(f"Miau! Utworzono przykładowy plik: {filename}")
    except Exception as e:
        print(f"Miau! Błąd podczas tworzenia przykładowego pliku '{filename}': {e}")

if __name__ == "__main__":
    print("Miau! Rozpoczynam masową konwersję obrazów! (≧∇≦)/")

    # --- Ustawienia katalogów wyjściowych ---\n
    jpg_output_dir = "jpg_output"
    webp_output_dir = "webp_output"

    # Tworzenie katalogów wyjściowych, jeśli nie istnieją
    os.makedirs(jpg_output_dir, exist_ok=True)
    os.makedirs(webp_output_dir, exist_ok=True)
    print(f"Miau! Upewniam się, że istnieją katalogi: '{jpg_output_dir}' i '{webp_output_dir}'.")

    # --- Generowanie przykładowych plików PNG, jeśli ich nie ma ---
    # Te pliki są tylko do demonstracji w ephemeral sandboxie.
    # W rzeczywistości umieść swoje własne zdjęcia w tym samym katalogu co skrypt!
    print("\nMiau! Tworzę przykładowe pliki obrazów do demonstracji...")
    # Tworzymy kilka przykładowych plików o różnych rozmiarach i formatach,
    # aby skrypt miał co przetwarzać.
    if not os.path.exists("photo_lens_1.png"):
        create_dummy_image("photo_lens_1.png", 2560, 1440, (255, 150, 150, 255), "Obiektyw nr 1 - Stan idealny!")
    if not os.path.exists("photo_lens_2.png"):
        create_dummy_image("photo_lens_2.png", 3840, 2160, (150, 255, 150, 255), "Obiektyw nr 2 - Piękny bokeh!")
    if not os.path.exists("photo_accessory.png"):
        create_dummy_image("photo_accessory.png", 1920, 1080, (150, 150, 255, 255), "Akcesorium - W zestawie!")
    if not os.path.exists("my_cat_picture.png"): # Miau! Musi być kocie zdjęcie!
        create_dummy_image("my_cat_picture.png", 1280, 720, (200, 200, 200, 255), "Miau! Moje zdjęcie!")
    if not os.path.exists("obiektyw_zebra.jpeg"): # Dodajemy też przykład JPEG, żeby skrypt go obsłużył
        try:
            from PIL import Image, ImageDraw
            img_jpeg = Image.new('RGB', (1024, 768), color = (200, 100, 50))
            d_jpeg = ImageDraw.Draw(img_jpeg)
            d_jpeg.text((20, 20), "Przykładowy JPEG do konwersji", fill=(255, 255, 255))
            img_jpeg.save("obiektyw_zebra.jpeg", format='JPEG', quality=95)
            print("Miau! Utworzono przykładowy plik: obiektyw_zebra.jpeg")
        except Exception as e:
            print(f"Miau! Błąd podczas tworzenia przykładowego pliku JPEG: {e}")


    # --- Rozszerzenia plików obrazów, które będziemy próbować konwertować ---
    # Możesz dodać więcej, jeśli masz inne typy obrazów.
    IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff')

    print("\n--- Rozpoczynam skanowanie bieżącego katalogu dla plików obrazów ---")
    files_in_current_directory = os.listdir('.') # '.' oznacza bieżący katalog
    converted_count = 0

    for filename in files_in_current_directory:
        # Sprawdzamy, czy plik jest faktycznym plikiem, ma rozszerzenie obrazu
        # i nie jest jednym z katalogów wyjściowych ani samym skryptem.
        if os.path.isfile(filename) and filename.lower().endswith(IMAGE_EXTENSIONS) and \
           filename not in [os.path.basename(jpg_output_dir), os.path.basename(webp_output_dir), 'image_converter.py']:

            print(f"\n--- Przetwarzam plik: {filename} ---")

            # Konwersja do JPEG (domyślna jakość 85, można zmienić)
            convert_image_to_smaller_format(filename, jpg_output_dir, target_format='jpeg', quality=85)

            # Konwersja do WebP (domyślna jakość 80, często lepsza kompresja niż JPEG)
            convert_image_to_smaller_format(filename, webp_output_dir, target_format='webp', quality=80)
            converted_count += 1
        elif os.path.isfile(filename):
            # Informuj o pomijanych plikach, które nie są obrazami lub są katalogami
            if not filename.endswith(IMAGE_EXTENSIONS + ('.py', '.txt', '.md')):
                print(f"Miau! Pomijam plik \'{filename}\' - nie jest to wspierany format obrazu do konwersji.")

    if converted_count == 0:
        print("\nMiau! Nie znaleziono żadnych plików obrazów do konwersji w bieżącym katalogu.")
        print("Upewnij się, że Twoje pliki PNG/JPG/itp. znajdują się w tym samym katalogu co skrypt,")
        print("a także, że skrypt nie jest w jednym z katalogów wyjściowych (jpg_output, webp_output).")
    else:
        print(f"\nKoniec! Miau! (≧∇≦)/ Pomyślnie przekonwertowano {converted_count} plików obrazów!")
        print(f"Sprawdź katalogi \'{jpg_output_dir}\' (JPEG) i \'{webp_output_dir}\' (WebP)!")