import Logo from "./Logo";
import NavControls from "./NavControls";
import Sections from "./Sections";

function Navbar() {
  // color 242424
  return (
    <nav className="z-50 bg-white/70 backdrop-blur-md fixed top-0 left-0  w-full flex justify-between items-center  px-5 py-5 sm:px-10">
      <Logo />
      <Sections />
      <NavControls />
    </nav>
  );
}

export default Navbar;
